/** Acesso a dados por profissional que depende do banco (clientes e vendas). */
import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { db as Db } from '../config/db';
import { pessoaProfissionais, pessoas, servicos, tecnicas, usuarios, vendas } from '../drizzle/schema';
import { filtroDono, incluiSemDono, podeGerenciar, type Escopo, type Sessao } from '../lib/escopo';

export type DbOuTx = typeof Db | Parameters<Parameters<typeof Db.transaction>[0]>[0];

/** O profissional usa os serviços da clínica? (admin: sempre) */
export async function usaServicosClinica(db: DbOuTx, idProfissional: number): Promise<boolean> {
    const [u] = await db
        .select({ perfil: usuarios.perfil, ve: usuarios.ve_servicos_clinica })
        .from(usuarios)
        .where(eq(usuarios.id, idProfissional))
        .limit(1);
    return !!u && (u.perfil === 'ADMIN' || Boolean(u.ve));
}

/** Condição SQL: serviços que o usuário logado enxerga (próprios + da clínica se liberado). */
export function servicosVisiveis(s: Sessao & { veServicosClinica?: boolean }): SQL | undefined {
    if (s.veTudo) return undefined;
    return s.veServicosClinica
        ? sql`(${servicos.id_profissional} IS NULL OR ${servicos.id_profissional} = ${s.id})`
        : sql`${servicos.id_profissional} = ${s.id}`;
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
