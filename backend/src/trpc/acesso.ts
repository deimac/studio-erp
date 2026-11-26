/** Acesso a dados por profissional que depende do banco (clientes e vendas). */
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { db as Db } from '../config/db';
import { pessoaProfissionais, pessoas, profissionalServicos, servicos, tecnicas, unidades, usuarios, vendas } from '../drizzle/schema';
import { servicoServeParaProfissional } from '../lib/servicosAcesso';
import { filtroDono, incluiSemDono, podeGerenciar, type Escopo, type Sessao } from '../lib/escopo';

export type DbOuTx = typeof Db | Parameters<Parameters<typeof Db.transaction>[0]>[0];

/**
 * O profissional usa os serviços da clínica? Admin: sempre.
 * Profissional: só no modo Admin (CLINICA); no "cada um cuida do seu", só os dele.
 */
export async function usaServicosClinica(db: DbOuTx, idProfissional: number): Promise<boolean> {
    const [u] = await db
        .select({ perfil: usuarios.perfil, modo: unidades.modo_trabalho })
        .from(usuarios)
        .leftJoin(unidades, eq(unidades.id, usuarios.id_unidade))
        .where(eq(usuarios.id, idProfissional))
        .limit(1);
    return !!u && (u.perfil === 'ADMIN' || u.modo !== 'INDIVIDUAL');
}

/**
 * Modo Admin: só o administrador cadastra serviços e técnicas.
 * (Profissional que usa os serviços da clínica = unidade no modo Admin.)
 */
export function assertPodeCadastrar(session: { perfil: string; veServicosClinica?: boolean }, oque = 'serviços') {
    if (session.perfil === 'PROFISSIONAL' && session.veServicosClinica)
        throw new TRPCError({ code: 'FORBIDDEN', message: `No modo Admin, só o administrador cadastra ${oque}` });
}

/** Quem atende cada serviço (id do serviço → profissionais indicados; vazio = todos). */
export async function quemAtendeServicos(db: DbOuTx, idsServico: number[]): Promise<Map<number, number[]>> {
    const mapa = new Map<number, number[]>();
    if (!idsServico.length) return mapa;
    const rows = await db
        .select({ s: profissionalServicos.id_servico, p: profissionalServicos.id_profissional })
        .from(profissionalServicos)
        .where(inArray(profissionalServicos.id_servico, idsServico));
    for (const r of rows) mapa.set(r.s, [...(mapa.get(r.s) ?? []), r.p]);
    return mapa;
}

/**
 * Primeiro serviço da lista que o profissional NÃO pode fazer/vender
 * (próprio de outro, ou da clínica sem ele em "quem atende"). undefined = todos servem.
 */
export async function servicoQueNaoServe<T extends { id: number | null; dono: number | null }>(db: DbOuTx, idProfissional: number, itens: T[]): Promise<T | undefined> {
    if (!itens.length) return undefined;
    const usaClinica = await usaServicosClinica(db, idProfissional);
    const quem = await quemAtendeServicos(db, itens.filter((i) => i.dono == null && i.id != null).map((i) => i.id as number));
    return itens.find((i) => !servicoServeParaProfissional(i.dono, idProfissional, usaClinica, i.id != null ? quem.get(i.id) ?? [] : []));
}

/** Condição SQL: o serviço da clínica é atendido pelo profissional (ninguém indicado = todos). */
function atendidoPor(idProfissional: number): SQL {
    return sql`(NOT EXISTS (SELECT 1 FROM profissional_servicos qa WHERE qa.id_servico = ${servicos.id})
        OR EXISTS (SELECT 1 FROM profissional_servicos qa WHERE qa.id_servico = ${servicos.id} AND qa.id_profissional = ${idProfissional}))`;
}

/** Condição SQL: serviços que o usuário logado enxerga (próprios + da clínica que atende). */
export function servicosVisiveis(s: Sessao & { veServicosClinica?: boolean }): SQL | undefined {
    if (s.veTudo) return undefined;
    if (!s.veServicosClinica) return sql`${servicos.id_profissional} = ${s.id}`;
    // Admin vê todos os da clínica; profissional, só os que atende
    const daClinica = s.perfil === 'ADMIN' ? sql`${servicos.id_profissional} IS NULL` : sql`(${servicos.id_profissional} IS NULL AND ${atendidoPor(s.id)})`;
    return sql`(${daClinica} OR ${servicos.id_profissional} = ${s.id})`;
}

/** Condição SQL: técnicas que o usuário logado enxerga. */
export function tecnicasVisiveis(s: Sessao & { veServicosClinica?: boolean }): SQL | undefined {
    if (s.veTudo) return undefined;
    return s.veServicosClinica
        ? sql`(${tecnicas.id_profissional} IS NULL OR ${tecnicas.id_profissional} = ${s.id})`
        : sql`${tecnicas.id_profissional} = ${s.id}`;
}

/** Condição SQL: a pessoa é atendida pelo profissional. */
export function pessoaDoProfissional(idProfissional: number): SQL {
    return sql`EXISTS (SELECT 1 FROM pessoa_profissionais pp WHERE pp.id_pessoa = ${pessoas.id} AND pp.id_profissional = ${idProfissional})`;
}

/** Pessoa sem nenhum profissional vinculado (cadastro antigo ou sem dono). */
const pessoaSemVinculo = sql`NOT EXISTS (SELECT 1 FROM pessoa_profissionais pp WHERE pp.id_pessoa = ${pessoas.id})`;

/** Condição SQL: pessoas que o usuário enxerga nas listas (undefined = todas). */
export function pessoasVisiveis(s: Sessao, escopo?: Escopo): SQL | undefined {
    const dono = filtroDono(s, escopo);
    if (dono == null) return undefined;
    return incluiSemDono(s) ? sql`(${pessoaDoProfissional(dono)} OR ${pessoaSemVinculo})` : pessoaDoProfissional(dono);
}

/** Garante o vínculo pessoa ↔ profissional (idempotente). */
export async function vincularPessoa(db: DbOuTx, idPessoa: number, idProfissional: number) {
    await db
        .insert(pessoaProfissionais)
        .values({ id_pessoa: idPessoa, id_profissional: idProfissional })
        .onDuplicateKeyUpdate({ set: { id_pessoa: sql`id_pessoa` } });
}

/** A pessoa existe na unidade e o usuário tem acesso a ela (admin: sempre). */
export async function assertAcessoPessoa(db: DbOuTx, s: Sessao & { unidadeId: number }, idPessoa: number) {
    const parts = [eq(pessoas.id, idPessoa), eq(pessoas.id_unidade, s.unidadeId), isNull(pessoas.deleted_at)];
    const visiveis = pessoasVisiveis(s);
    if (visiveis) parts.push(visiveis);
    const [p] = await db.select({ id: pessoas.id }).from(pessoas).where(and(...parts)).limit(1);
    if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pessoa não encontrada' });
}

/** Busca a venda da unidade e confere se o usuário pode gerenciá-la. */
export async function vendaGerenciavel(db: DbOuTx, s: Sessao & { unidadeId: number }, idVenda: number) {
    const [v] = await db
        .select({ id: vendas.id, status: vendas.status, dono: vendas.id_profissional, data_venda: vendas.data_venda })
        .from(vendas)
        .where(and(eq(vendas.id, idVenda), eq(vendas.id_unidade, s.unidadeId), isNull(vendas.deleted_at)))
        .limit(1);
    if (!v || !podeGerenciar(v.dono, s)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
    return v;
}
