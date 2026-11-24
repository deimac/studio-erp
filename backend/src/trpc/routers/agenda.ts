import { TRPCError } from '@trpc/server';
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, gte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
    agendaBloqueios,
    agendaRecorrencias,
    atendimentoServicos,
    atendimentos,
    pacotes,
    pessoas,
    profissionalHorarios,
    profissionalServicos,
    salas,
    servicos,
    usuarios,
    vendas,
    vendaItens,
    atendimentoItens,
    unidades,
    formasPagamento,
} from '../../drizzle/schema';
import {
    STATUS_OCUPAM,
    calcularFim,
    distribuirNovos,
    faltaConsome,
    regraFaltaEfetiva,
    type NovoItemAgenda,
    type RegraFalta,
    conflitosImpeditivos,
    gerarOcorrencias,
    hhmmParaMin,
    horariosLivres,
    linkWhatsApp,
    mensagemWhatsApp,
    minParaHHMM,
    somarDias,
    verificarConflitos,
    type BloqueioAgenda,
    type Conflito,
    type HorarioTrabalho,
    type Ocupacao,
    type StatusAtendimento,
} from '../../lib/agenda';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';
import { servicoServeParaProfissional } from '../../lib/servicosAcesso';
import { assertAcessoPessoa, usaServicosClinica, vincularPessoa } from '../acesso';
import { CONSOME_SESSAO, rotuloItensAtendimento, rotuloVenda } from '../vendaItens';
import { gravarVenda } from '../vendaGravar';
import { normalizarTelefone } from '../../lib/telefone';

/** Telefone em formato internacional; inválido → erro para o usuário corrigir. */
function telefoneValido(v: string | null | undefined): string | null {
    const n = normalizarTelefone(v);
    if (n === undefined) erro('BAD_REQUEST', 'Telefone inválido: confira o país e o número');
    return n ?? null;
}
import type { Session } from '../context';
import type { db as Db } from '../../config/db';

type DbOuTx = typeof Db | Parameters<Parameters<typeof Db.transaction>[0]>[0];

/* ============================== helpers ============================== */

const zData = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)');
const zHora = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Horário inválido (HH:MM)');
const zId = z.number().int().positive();

const dataStr = sql<string>`DATE_FORMAT(${atendimentos.data}, '%Y-%m-%d')`;
const STATUS_ABERTOS: StatusAtendimento[] = ['AGENDADO', 'CONFIRMADO'];

function erro(code: 'BAD_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT', message: string): never {
    throw new TRPCError({ code, message });
}

function dataParaDate(data: string) {
    return new Date(`${data}T00:00:00`);
}

function hora(min: number) {
    return `${minParaHHMM(min)}:00`;
}

const isAdmin = (s: Session) => s.perfil === 'ADMIN';

/** Profissional só mexe na própria agenda; admin em todas. */
function assertPodeGerenciar(s: Session, idProfissional: number) {
    if (!isAdmin(s) && idProfissional !== s.id) erro('FORBIDDEN', 'Você só pode alterar a sua própria agenda');
}

function mensagemConflitos(conflitos: Conflito[]) {
    return conflitos.map((c) => c.mensagem).join(' · ');
}

async function assertProfissional(db: DbOuTx, unidadeId: number, id: number) {
    const [p] = await db
        .select({ id: usuarios.id, ativo: usuarios.ativo })
        .from(usuarios)
        .where(and(eq(usuarios.id, id), eq(usuarios.id_unidade, unidadeId)))
        .limit(1);
    if (!p?.ativo) erro('BAD_REQUEST', 'Profissional inválido ou inativo');
}

async function assertSala(db: DbOuTx, unidadeId: number, id: number | null | undefined) {
    if (id == null) return;
    const [s] = await db
        .select({ id: salas.id, ativo: salas.ativo })
        .from(salas)
        .where(and(eq(salas.id, id), eq(salas.id_unidade, unidadeId)))
        .limit(1);
    if (!s?.ativo) erro('BAD_REQUEST', 'Sala inválida ou inativa');
}

async function carregarServicos(db: DbOuTx, ids: number[], idProfissional: number) {
    const unicos = [...new Set(ids)];
    if (!unicos.length) return [];
    const rows = await db
        .select({ id: servicos.id, nome: servicos.nome, duracao: servicos.duracao_minutos, valor: servicos.valor, ativo: servicos.ativo, dono: servicos.id_profissional })
        .from(servicos)
        .where(inArray(servicos.id, unicos));
    if (rows.length !== unicos.length) erro('BAD_REQUEST', 'Serviço não encontrado');
    const usaClinica = await usaServicosClinica(db, idProfissional);
    const deOutro = rows.find((r) => !servicoServeParaProfissional(r.dono, idProfissional, usaClinica));
    if (deOutro)
        erro('BAD_REQUEST', deOutro.dono == null ? `"${deOutro.nome}" é um serviço da clínica, não liberado para este profissional` : `"${deOutro.nome}" é um serviço próprio de outro profissional`);
    // mantém a ordem escolhida
    return unicos.map((id) => rows.find((r) => r.id === id)!);
}

/** Sessões do item da venda já comprometidas (agendadas, confirmadas, realizadas ou faltas descontadas). */
async function sessoesUsadas(db: DbOuTx, idItem: number, ignorarIds: number[] = []) {
    const parts = [
        eq(atendimentoItens.id_venda_item, idItem),
        or(inArray(atendimentos.status, [...STATUS_OCUPAM]), and(eq(atendimentos.status, 'FALTOU'), eq(atendimentos.falta_consome, true)))!,
    ];
    if (ignorarIds.length) parts.push(sql`${atendimentos.id} NOT IN (${sql.join(ignorarIds.map((i) => sql`${i}`), sql`, `)})`);
    const [r] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(atendimentoItens)
        .innerJoin(atendimentos, eq(atendimentos.id, atendimentoItens.id_atendimento))
        .where(and(...parts));
    return Number(r?.n ?? 0);
}

/**
 * Valida os itens já comprados que o atendimento vai usar (cliente, profissional,
 * venda ativa e saldo para todas as datas). Devolve venda e serviço de cada um.
 */
async function validarItens(
    db: DbOuTx,
    unidadeId: number,
    ids: number[],
    idPessoa: number,
    novas: number,
    idProfissional: number,
    ignorarIds: number[] = [],
): Promise<{ id: number; id_venda: number; id_servico: number | null }[]> {
    const unicos = [...new Set(ids)];
    const out: { id: number; id_venda: number; id_servico: number | null }[] = [];
    for (const id of unicos) {
        const [it] = await db
            .select({
                id: vendaItens.id,
                id_venda: vendaItens.id_venda,
                qtd: vendaItens.quantidade_sessoes,
                id_servico: sql<number | null>`COALESCE(${vendaItens.id_servico}, ${pacotes.id_servico})`,
                nome: sql<string>`COALESCE(${pacotes.nome}, (SELECT s2.nome FROM servicos s2 WHERE s2.id = ${vendaItens.id_servico}), ${vendaItens.descricao}, 'Item')`,
                status: vendas.status,
                id_pessoa: vendas.id_pessoa,
                deleted_at: vendas.deleted_at,
                dono: vendas.id_profissional,
                unidade: vendas.id_unidade,
            })
            .from(vendaItens)
            .innerJoin(vendas, eq(vendas.id, vendaItens.id_venda))
            .leftJoin(pacotes, eq(pacotes.id, vendaItens.id_pacote))
            .where(eq(vendaItens.id, id))
            .limit(1);
        if (!it || it.unidade !== unidadeId || it.deleted_at) erro('NOT_FOUND', 'Item da venda não encontrado');
        if (it.status !== 'ATIVA') erro('CONFLICT', `"${it.nome}": a venda não está ativa`);
        if (it.id_pessoa !== idPessoa) erro('BAD_REQUEST', `"${it.nome}" é de outro cliente`);
        if (it.dono != null && it.dono !== idProfissional) erro('BAD_REQUEST', `"${it.nome}" foi vendido por outro profissional`);
        const restantes = it.qtd - (await sessoesUsadas(db, it.id, ignorarIds));
        if (restantes < novas) erro('CONFLICT', `"${it.nome}" tem só ${Math.max(restantes, 0)} sessão(ões) disponível(is)`);
        out.push({ id: it.id, id_venda: it.id_venda, id_servico: it.id_servico });
    }
    return out;
}

/** Regra de falta que vale para o profissional (da clínica ou a dele, se a clínica permitir). */
async function regraFaltaDoProfissional(db: DbOuTx, unidadeId: number, idProfissional: number): Promise<RegraFalta> {
    const [c] = await db
        .select({ falta_regra: unidades.falta_regra, falta_por_profissional: unidades.falta_por_profissional })
        .from(unidades)
        .where(eq(unidades.id, unidadeId))
        .limit(1);
    const [u] = await db.select({ falta_regra: usuarios.falta_regra }).from(usuarios).where(eq(usuarios.id, idProfissional)).limit(1);
    return regraFaltaEfetiva(
        { falta_regra: (c?.falta_regra ?? 'PERGUNTAR') as RegraFalta, falta_por_profissional: Boolean(c?.falta_por_profissional) },
        u ? { falta_regra: (u.falta_regra ?? null) as RegraFalta | null } : null,
    );
}

/** Profissionais ativos da unidade com agenda compartilhada. */
async function carregarCompartilhados(db: DbOuTx, unidadeId: number): Promise<number[]> {
    const rows = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(eq(usuarios.id_unidade, unidadeId), eq(usuarios.ativo, true), eq(usuarios.agenda_compartilhada, true)));
    return rows.map((r) => r.id);
}

/**
 * Carrega (e trava, dentro de transação) o que pode conflitar nas datas:
 * atendimentos do profissional e da sala, bloqueios e expediente.
 */
async function carregarContexto(
    db: DbOuTx,
    args: { unidadeId: number; datas: string[]; idProfissional: number; idSala: number | null; travar?: boolean },
) {
    const { unidadeId, datas, idProfissional, idSala } = args;
    const ordenadas = [...datas].sort();
    const de = ordenadas[0];
    const ate = ordenadas[ordenadas.length - 1];

    const compartilhados = await carregarCompartilhados(db, unidadeId);
    // Profissional do grupo compartilhado disputa o horário com todos do grupo
    const profissionaisAlvo = compartilhados.includes(idProfissional) ? compartilhados : [idProfissional];
    const recursos = idSala != null
        ? or(inArray(atendimentos.id_profissional, profissionaisAlvo), eq(atendimentos.id_sala, idSala))
        : inArray(atendimentos.id_profissional, profissionaisAlvo);

    let q = db
        .select({
            id: atendimentos.id,
            data: dataStr,
            hora_inicio: atendimentos.hora_inicio,
            hora_fim: atendimentos.hora_fim,
            id_profissional: atendimentos.id_profissional,
            id_sala: atendimentos.id_sala,
            status: atendimentos.status,
        })
        .from(atendimentos)
        .where(and(eq(atendimentos.id_unidade, unidadeId), sql`${atendimentos.data} IN (${sql.join(ordenadas.map((d) => sql`${d}`), sql`, `)})`, recursos))
        .$dynamic();
    if (args.travar) q = q.for('update');
    const rows = await q;

    const existentes: Ocupacao[] = rows.map((r) => ({
        id: r.id,
        data: r.data,
        inicio: hhmmParaMin(r.hora_inicio),
        fim: hhmmParaMin(r.hora_fim),
        id_profissional: r.id_profissional,
        id_sala: r.id_sala,
        status: r.status,
    }));

    const bloqueios: BloqueioAgenda[] = await db
        .select({
            id: agendaBloqueios.id,
            id_profissional: agendaBloqueios.id_profissional,
            id_sala: agendaBloqueios.id_sala,
            inicio: agendaBloqueios.inicio,
            fim: agendaBloqueios.fim,
            motivo: agendaBloqueios.motivo,
        })
        .from(agendaBloqueios)
        .where(
            and(
                eq(agendaBloqueios.id_unidade, unidadeId),
                lte(agendaBloqueios.inicio, `${ate} 23:59:59`),
                gte(agendaBloqueios.fim, `${de} 00:00:00`),
            ),
        );

    const horarios = await carregarHorarios(db, idProfissional);
    return { existentes, bloqueios, horarios, compartilhados };
}

async function carregarHorarios(db: DbOuTx, idProfissional: number): Promise<HorarioTrabalho[]> {
    const rows = await db
        .select()
        .from(profissionalHorarios)
        .where(eq(profissionalHorarios.id_profissional, idProfissional));
    return rows.map((h) => ({ dia_semana: h.dia_semana, inicio: hhmmParaMin(h.hora_inicio), fim: hhmmParaMin(h.hora_fim) }));
}

async function buscarAtendimento(db: DbOuTx, unidadeId: number, id: number) {
    const [a] = await db
        .select({
            id: atendimentos.id,
            id_pessoa: atendimentos.id_pessoa,
            id_venda: atendimentos.id_venda,
            id_venda_item: atendimentos.id_venda_item,
            titulo_extra: atendimentos.titulo_extra,
            id_venda_extra: atendimentos.id_venda_extra,
            id_profissional: atendimentos.id_profissional,
            id_sala: atendimentos.id_sala,
            id_recorrencia: atendimentos.id_recorrencia,
            data: dataStr,
            hora_inicio: atendimentos.hora_inicio,
            hora_fim: atendimentos.hora_fim,
            status: atendimentos.status,
        })
        .from(atendimentos)
        .where(and(eq(atendimentos.id, id), eq(atendimentos.id_unidade, unidadeId)))
        .limit(1);
    if (!a) erro('NOT_FOUND', 'Atendimento não encontrado');
    return a;
}

async function dadosMensagem(db: DbOuTx, unidadeId: number, id: number) {
    const [a] = await db
        .select({
            id: atendimentos.id,
            id_profissional: atendimentos.id_profissional,
            data: dataStr,
            hora_inicio: atendimentos.hora_inicio,
            cliente: pessoas.nome,
            telefone: pessoas.telefone,
            profissional: usuarios.nome,
            servicos: sql<string | null>`NULLIF(CONCAT_WS(', ', (SELECT GROUP_CONCAT(s.nome ORDER BY s.nome SEPARATOR ', ') FROM atendimento_servicos x JOIN servicos s ON s.id = x.id_servico WHERE x.id_atendimento = ${atendimentos.id}), ${atendimentos.titulo_extra}), '')`,
        })
        .from(atendimentos)
        .innerJoin(pessoas, eq(pessoas.id, atendimentos.id_pessoa))
        .innerJoin(usuarios, eq(usuarios.id, atendimentos.id_profissional))
        .where(and(eq(atendimentos.id, id), eq(atendimentos.id_unidade, unidadeId)))
        .limit(1);
    if (!a) erro('NOT_FOUND', 'Atendimento não encontrado');
    return a;
}

function montarWhatsApp(tipo: 'CONFIRMACAO' | 'LEMBRETE', a: Awaited<ReturnType<typeof dadosMensagem>>) {
    const mensagem = mensagemWhatsApp(tipo, {
        cliente: a.cliente,
        servicos: a.servicos ?? 'atendimento',
        data: a.data,
        hora: a.hora_inicio.slice(0, 5),
        profissional: a.profissional,
    });
    return { mensagem, link: linkWhatsApp(a.telefone, mensagem), telefone: a.telefone };
}

/* ============================== sub-routers ============================== */

const salasRouter = createTRPCRouter({
    list: protectedProcedure
        .input(z.object({ incluirInativas: z.boolean().optional() }).optional())
        .query(({ ctx, input }) =>
            ctx.db
                .select()
                .from(salas)
                .where(and(eq(salas.id_unidade, ctx.session.unidadeId), input?.incluirInativas ? undefined : eq(salas.ativo, true)))
                .orderBy(asc(salas.ordem), asc(salas.nome)),
        ),

    create: adminProcedure
        .input(z.object({ nome: z.string().trim().min(1).max(100), cor: z.string().max(20).optional(), ordem: z.number().int().optional() }))
        .mutation(async ({ ctx, input }) => {
            const [r] = await ctx.db
                .insert(salas)
                .values({ id_unidade: ctx.session.unidadeId, nome: input.nome, cor: input.cor, ordem: input.ordem ?? 0 })
                .$returningId();
            return { id: r?.id };
        }),

    update: adminProcedure
        .input(
            z.object({
                id: zId,
                nome: z.string().trim().min(1).max(100).optional(),
                cor: z.string().max(20).nullable().optional(),
                ordem: z.number().int().optional(),
                ativo: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...campos } = input;
            await ctx.db
                .update(salas)
                .set({ ...campos, updated_at: new Date() })
                .where(and(eq(salas.id, id), eq(salas.id_unidade, ctx.session.unidadeId)));
            return { ok: true };
        }),

    delete: adminProcedure.input(z.object({ id: zId })).mutation(async ({ ctx, input }) => {
        const [uso] = await ctx.db
            .select({ n: sql<number>`COUNT(*)` })
            .from(atendimentos)
            .where(eq(atendimentos.id_sala, input.id));
        if (Number(uso?.n ?? 0) > 0) erro('CONFLICT', 'Sala já usada em atendimentos: desative em vez de excluir');
        await ctx.db.delete(salas).where(and(eq(salas.id, input.id), eq(salas.id_unidade, ctx.session.unidadeId)));
        return { ok: true };
    }),
});

const horariosRouter = createTRPCRouter({
    get: protectedProcedure
        .input(z.object({ id_profissional: zId.optional() }).optional())
        .query(async ({ ctx, input }) => {
            const id = input?.id_profissional ?? ctx.session.id;
            const [u] = await ctx.db
                .select({ intervalo: usuarios.intervalo_agenda_min })
                .from(usuarios)
                .where(and(eq(usuarios.id, id), eq(usuarios.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!u) erro('NOT_FOUND', 'Profissional não encontrado');
            const periodos = await ctx.db
                .select()
                .from(profissionalHorarios)
                .where(eq(profissionalHorarios.id_profissional, id))
                .orderBy(asc(profissionalHorarios.dia_semana), asc(profissionalHorarios.hora_inicio));
            return {
                intervalo_agenda_min: u.intervalo,
                periodos: periodos.map((p) => ({ dia_semana: p.dia_semana, hora_inicio: p.hora_inicio.slice(0, 5), hora_fim: p.hora_fim.slice(0, 5) })),
            };
        }),

    set: protectedProcedure
        .input(
            z.object({
                id_profissional: zId.optional(),
                intervalo_agenda_min: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]).optional(),
                periodos: z.array(z.object({ dia_semana: z.number().int().min(0).max(6), hora_inicio: zHora, hora_fim: zHora })),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const id = input.id_profissional ?? ctx.session.id;
            assertPodeGerenciar(ctx.session, id);
            await assertProfissional(ctx.db, ctx.session.unidadeId, id);

            const periodos = input.periodos.map((p) => ({ ...p, inicio: hhmmParaMin(p.hora_inicio), fim: hhmmParaMin(p.hora_fim) }));
            for (const p of periodos) if (p.fim <= p.inicio) erro('BAD_REQUEST', `Período ${p.hora_inicio}–${p.hora_fim} inválido`);
            for (let i = 0; i < periodos.length; i++)
                for (let j = i + 1; j < periodos.length; j++) {
                    const a = periodos[i];
                    const b = periodos[j];
                    if (a.dia_semana === b.dia_semana && a.inicio < b.fim && b.inicio < a.fim)
                        erro('BAD_REQUEST', 'Há períodos sobrepostos no mesmo dia');
                }

            await ctx.db.transaction(async (tx) => {
                await tx.delete(profissionalHorarios).where(eq(profissionalHorarios.id_profissional, id));
                if (periodos.length)
                    await tx.insert(profissionalHorarios).values(
                        periodos.map((p) => ({ id_profissional: id, dia_semana: p.dia_semana, hora_inicio: hora(p.inicio), hora_fim: hora(p.fim) })),
                    );
                if (input.intervalo_agenda_min)
                    await tx.update(usuarios).set({ intervalo_agenda_min: input.intervalo_agenda_min }).where(eq(usuarios.id, id));
            });
            return { ok: true };
        }),
});

const zDataHora = z.string().regex(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/, 'Data/hora inválida');
const normDataHora = (v: string) => {
    const [d, h] = v.split(/[ T]/);
    return `${d} ${h.slice(0, 5)}:00`;
};

const bloqueiosRouter = createTRPCRouter({
    list: protectedProcedure.input(z.object({ de: zData, ate: zData })).query(({ ctx, input }) =>
        ctx.db
            .select()
            .from(agendaBloqueios)
            .where(
                and(
                    eq(agendaBloqueios.id_unidade, ctx.session.unidadeId),
                    lte(agendaBloqueios.inicio, `${input.ate} 23:59:59`),
                    gte(agendaBloqueios.fim, `${input.de} 00:00:00`),
                ),
            )
            .orderBy(asc(agendaBloqueios.inicio)),
    ),

    create: protectedProcedure
        .input(
            z.object({
                id_profissional: zId.nullable().optional(),
                id_sala: zId.nullable().optional(),
                inicio: zDataHora,
                fim: zDataHora,
                motivo: z.string().max(255).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const inicio = normDataHora(input.inicio);
            const fim = normDataHora(input.fim);
            if (fim <= inicio) erro('BAD_REQUEST', 'O fim do bloqueio deve ser depois do início');
            let idProf = input.id_profissional ?? null;
            const idSala = input.id_sala ?? null;
            if (!isAdmin(ctx.session)) {
                // profissional só bloqueia a própria agenda
                if (idSala != null || (idProf != null && idProf !== ctx.session.id)) erro('FORBIDDEN', 'Você só pode bloquear a sua própria agenda');
                idProf = ctx.session.id;
            }
            if (idProf != null) await assertProfissional(ctx.db, ctx.session.unidadeId, idProf);
            await assertSala(ctx.db, ctx.session.unidadeId, idSala);
            const [r] = await ctx.db
                .insert(agendaBloqueios)
                .values({ id_unidade: ctx.session.unidadeId, id_profissional: idProf, id_sala: idSala, inicio, fim, motivo: input.motivo, criado_por: ctx.session.id })
                .$returningId();
            return { id: r?.id };
        }),

    delete: protectedProcedure.input(z.object({ id: zId })).mutation(async ({ ctx, input }) => {
        const [b] = await ctx.db
            .select({ id: agendaBloqueios.id, id_profissional: agendaBloqueios.id_profissional })
            .from(agendaBloqueios)
            .where(and(eq(agendaBloqueios.id, input.id), eq(agendaBloqueios.id_unidade, ctx.session.unidadeId)))
            .limit(1);
        if (!b) erro('NOT_FOUND', 'Bloqueio não encontrado');
        if (!isAdmin(ctx.session) && b.id_profissional !== ctx.session.id) erro('FORBIDDEN', 'Sem permissão');
        await ctx.db.delete(agendaBloqueios).where(eq(agendaBloqueios.id, input.id));
        return { ok: true };
    }),
});

const profissionaisRouter = createTRPCRouter({
    /** Lista para a agenda (todos os perfis enxergam os colegas). */
    list: protectedProcedure.query(({ ctx }) =>
        ctx.db
            .select({
                id: usuarios.id,
                nome: usuarios.nome,
                perfil: usuarios.perfil,
                cor: usuarios.cor,
                telefone: usuarios.telefone,
                intervalo_agenda_min: usuarios.intervalo_agenda_min,
                agenda_compartilhada: usuarios.agenda_compartilhada,
                ve_servicos_clinica: usuarios.ve_servicos_clinica,
                falta_regra: usuarios.falta_regra,
            })
            .from(usuarios)
            .where(and(eq(usuarios.id_unidade, ctx.session.unidadeId), eq(usuarios.ativo, true)))
            .orderBy(asc(usuarios.nome)),
    ),

    update: protectedProcedure
        .input(
            z.object({
                id: zId,
                cor: z.string().max(20).nullable().optional(),
                telefone: z.string().max(25).nullable().optional(),
                agenda_compartilhada: z.boolean().optional(),
                ve_servicos_clinica: z.boolean().optional(),
                /** Regra de falta própria (null = segue a da clínica). */
                falta_regra: z.enum(['DESCONTAR', 'DEVOLVER', 'PERGUNTAR']).nullable().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            assertPodeGerenciar(ctx.session, input.id);
            if ((input.agenda_compartilhada !== undefined || input.ve_servicos_clinica !== undefined) && !isAdmin(ctx.session))
                erro('FORBIDDEN', 'Só o administrador altera essas configurações');
            const { id, ...campos } = input;
            if (campos.telefone !== undefined) campos.telefone = telefoneValido(campos.telefone);
            await ctx.db
                .update(usuarios)
                .set({ ...campos, updated_at: new Date() })
                .where(and(eq(usuarios.id, id), eq(usuarios.id_unidade, ctx.session.unidadeId)));
            return { ok: true };
        }),

    /** Regra de falta que vale para o profissional, e se a clínica deixa ele escolher. */
    regraFalta: protectedProcedure.input(z.object({ id_profissional: zId.optional() })).query(async ({ ctx, input }) => {
        const id = input.id_profissional ?? ctx.session.id;
        const [c] = await ctx.db
            .select({ falta_regra: unidades.falta_regra, falta_por_profissional: unidades.falta_por_profissional })
            .from(unidades)
            .where(eq(unidades.id, ctx.session.unidadeId))
            .limit(1);
        return {
            regra: await regraFaltaDoProfissional(ctx.db, ctx.session.unidadeId, id),
            clinica: (c?.falta_regra ?? 'PERGUNTAR') as RegraFalta,
            porProfissional: Boolean(c?.falta_por_profissional),
        };
    }),

    /** Configuração da clínica para faltas (só o admin altera). */
    salvarRegraFaltaClinica: adminProcedure
        .input(z.object({ falta_regra: z.enum(['DESCONTAR', 'DEVOLVER', 'PERGUNTAR']), falta_por_profissional: z.boolean() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.update(unidades).set({ ...input, updated_at: new Date() }).where(eq(unidades.id, ctx.session.unidadeId));
            return { ok: true };
        }),

    servicos: protectedProcedure.input(z.object({ id_profissional: zId })).query(async ({ ctx, input }) => {
        const rows = await ctx.db
            .select({ id: profissionalServicos.id_servico })
            .from(profissionalServicos)
            .where(eq(profissionalServicos.id_profissional, input.id_profissional));
        return rows.map((r) => r.id);
    }),

    setServicos: adminProcedure
        .input(z.object({ id_profissional: zId, servicos: z.array(zId) }))
        .mutation(async ({ ctx, input }) => {
            await assertProfissional(ctx.db, ctx.session.unidadeId, input.id_profissional);
            await ctx.db.transaction(async (tx) => {
                await tx.delete(profissionalServicos).where(eq(profissionalServicos.id_profissional, input.id_profissional));
                const ids = [...new Set(input.servicos)];
                if (ids.length)
                    await tx.insert(profissionalServicos).values(ids.map((id_servico) => ({ id_profissional: input.id_profissional, id_servico })));
            });
            return { ok: true };
        }),
});

/* ============================== router principal ============================== */

/** Venda feita no próprio agendamento: serviços, pacotes e serviço sem cadastro. */
const zVendaAgenda = z.object({
    itens: z
        .array(
            z.object({
                id_servico: zId.optional(),
                id_pacote: zId.optional(),
                /** Serviço sem cadastro. */
                descricao: z.string().trim().min(2).max(120).optional(),
                /** Preço da sessão (serviço/sem cadastro) ou total do pacote. */
                valor: z.number().min(0),
                /** Sessões do pacote. */
                sessoes: z.number().int().positive().optional(),
            }),
        )
        .min(1),
    /** Vazio = tudo a receber, forma definida na baixa. */
    pagamentos: z
        .array(
            z.object({
                id_forma_pagamento: zId.nullable().optional(),
                valor: z.number().positive(),
                parcelas: z.number().int().positive().max(48).default(1),
                vencimento: zData.optional(),
                pago: z.boolean().default(false),
            }),
        )
        .default([]),
});
type VendaAgenda = z.infer<typeof zVendaAgenda>;

/**
 * Lança a venda feita no agendamento e diz quais datas cada item cobre
 * (avulso/sem cadastro: uma sessão por data; pacote: até acabar as sessões).
 */
async function venderNoAgendamento(tx: DbOuTx, s: Session, venda: VendaAgenda, idPessoa: number, idProf: number, datas: string[]) {
    const usaClinica = await usaServicosClinica(tx, idProf);
    const tipos: NovoItemAgenda[] = [];
    const base: { id_servico?: number; id_pacote?: number; descricao?: string; id_servico_sessao: number | null }[] = [];
    for (const it of venda.itens) {
        const qtd = [it.id_servico, it.id_pacote, it.descricao].filter(Boolean).length;
        if (qtd !== 1) erro('BAD_REQUEST', 'Cada item é um serviço, um pacote ou um serviço sem cadastro');
        if (it.id_servico) {
            const [sv] = await tx.select({ dono: servicos.id_profissional, ativo: servicos.ativo, nome: servicos.nome }).from(servicos).where(eq(servicos.id, it.id_servico)).limit(1);
            if (!sv || !sv.ativo) erro('NOT_FOUND', 'Serviço não encontrado');
            if (!servicoServeParaProfissional(sv.dono, idProf, usaClinica)) erro('BAD_REQUEST', `"${sv.nome}" não é deste profissional`);
            tipos.push({ tipo: 'servico', sessoes: 1, valor: it.valor });
            base.push({ id_servico: it.id_servico, id_servico_sessao: it.id_servico });
        } else if (it.id_pacote) {
            const [pk] = await tx
                .select({ dono: servicos.id_profissional, status: pacotes.status, nome: pacotes.nome, sessoes: pacotes.quantidade_sessoes, id_servico: pacotes.id_servico })
                .from(pacotes)
                .leftJoin(servicos, eq(servicos.id, pacotes.id_servico))
                .where(eq(pacotes.id, it.id_pacote))
                .limit(1);
            if (!pk || String(pk.status).toLowerCase() !== 'ativo') erro('NOT_FOUND', 'Pacote não encontrado');
            if (!servicoServeParaProfissional(pk.dono ?? null, idProf, usaClinica)) erro('BAD_REQUEST', `"${pk.nome}" não é deste profissional`);
            tipos.push({ tipo: 'pacote', sessoes: it.sessoes ?? pk.sessoes, valor: it.valor });
            base.push({ id_pacote: it.id_pacote, id_servico_sessao: pk.id_servico ?? null });
        } else {
            tipos.push({ tipo: 'livre', sessoes: 1, valor: it.valor });
            base.push({ descricao: it.descricao, id_servico_sessao: null });
        }
    }
    const plano = distribuirNovos(tipos, datas.length);
    // Itens sem valor (ex.: sem cadastro gratuito) não entram na venda
    const cobrados = plano.map((p, i) => ({ ...p, ...base[i] })).filter((p) => p.valor > 0);
    if (!cobrados.length) return { itens: [] as { id: number; datas: number[]; id_servico_sessao: number | null }[] };

    const totalC = cobrados.reduce((t, p) => t + Math.round(p.valor * 100), 0);
    const hoje = dataParaDate(new Date().toISOString().slice(0, 10));
    const vencPadrao = dataParaDate(datas[0] < new Date().toISOString().slice(0, 10) ? new Date().toISOString().slice(0, 10) : datas[0]);
    let pagamentos = venda.pagamentos;
    if (!pagamentos.length) pagamentos = [{ id_forma_pagamento: null, valor: totalC / 100, parcelas: 1, pago: false }];
    const pagoC = pagamentos.reduce((t, p) => t + Math.round(p.valor * 100), 0);
    if (pagoC !== totalC) erro('BAD_REQUEST', `Os pagamentos somam R$ ${(pagoC / 100).toFixed(2)}, mas a venda é de R$ ${(totalC / 100).toFixed(2)}`);
    for (const p of pagamentos) {
        if (p.pago && !p.id_forma_pagamento) erro('BAD_REQUEST', 'Informe a forma do pagamento já recebido');
        if (p.pago && p.parcelas > 1) erro('BAD_REQUEST', 'Só um pagamento à vista pode ser marcado como já recebido');
        if (p.id_forma_pagamento) {
            const [fp] = await tx.select({ id: formasPagamento.id }).from(formasPagamento)
                .where(and(eq(formasPagamento.id, p.id_forma_pagamento), eq(formasPagamento.ativo, true))).limit(1);
            if (!fp) erro('NOT_FOUND', 'Forma de pagamento não encontrada');
        }
    }

    const idVenda = await gravarVenda(tx, {
        unidadeId: s.unidadeId,
        id_pessoa: idPessoa,
        vendedor: idProf,
        data_venda: hoje,
        itens: cobrados.map((c) => ({ id_servico: c.id_servico, id_pacote: c.id_pacote, descricao: c.descricao, quantidade_sessoes: c.sessoes, valor: c.valor })),
        pagamentos: pagamentos.map((p) => ({
            id_forma_pagamento: p.id_forma_pagamento ?? null,
            valor: p.valor,
            parcelas: p.parcelas,
            primeiro_vencimento: p.vencimento ? dataParaDate(p.vencimento) : vencPadrao,
            pago: p.pago,
        })),
    });
    const ids = await tx.select({ id: vendaItens.id }).from(vendaItens).where(eq(vendaItens.id_venda, idVenda)).orderBy(asc(vendaItens.id));
    return { idVenda, itens: cobrados.map((c, i) => ({ id: ids[i]!.id, datas: c.datas, id_servico_sessao: c.id_servico_sessao })) };
}

/** Itens de venda já ligados ao atendimento. */
async function itensDoAtendimento(tx: DbOuTx, idAtendimento: number) {
    return tx
        .select({ id: vendaItens.id, id_venda: vendaItens.id_venda })
        .from(atendimentoItens)
        .innerJoin(vendaItens, eq(vendaItens.id, atendimentoItens.id_venda_item))
        .where(eq(atendimentoItens.id_atendimento, idAtendimento));
}

/** Liga os itens de venda ao atendimento (substitui os vínculos anteriores). */
async function ligarItens(tx: DbOuTx, idAtendimento: number, itens: { id: number; id_venda: number }[]) {
    await tx.delete(atendimentoItens).where(eq(atendimentoItens.id_atendimento, idAtendimento));
    if (itens.length) await tx.insert(atendimentoItens).values(itens.map((i) => ({ id_atendimento: idAtendimento, id_venda_item: i.id })));
    // Colunas antigas guardam o 1º item (rótulos e regra de falta)
    await tx
        .update(atendimentos)
        .set({ id_venda_item: itens[0]?.id ?? null, id_venda: itens[0]?.id_venda ?? null })
        .where(eq(atendimentos.id, idAtendimento));
}

const zRecorrencia = z.object({ quantidade: z.number().int().min(2).max(52), intervalo_semanas: z.number().int().min(1).max(4).default(1) });

export const agendaRouter = createTRPCRouter({
    salas: salasRouter,
    horarios: horariosRouter,
    bloqueios: bloqueiosRouter,
    profissionais: profissionaisRouter,

    /** Tudo que o calendário precisa para o período. */
    eventos: protectedProcedure
        .input(
            z.object({
                de: zData,
                ate: zData,
                profissionais: z.array(zId).optional(),
                salas: z.array(zId).optional(),
                incluirCancelados: z.boolean().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const parts = [
                eq(atendimentos.id_unidade, ctx.session.unidadeId),
                sql`${atendimentos.data} BETWEEN ${input.de} AND ${input.ate}`,
            ];
            if (input.profissionais?.length) parts.push(inArray(atendimentos.id_profissional, input.profissionais));
            if (input.salas?.length) parts.push(inArray(atendimentos.id_sala, input.salas));
            if (!input.incluirCancelados) parts.push(ne(atendimentos.status, 'CANCELADO'));

            const rows = await ctx.db
                .select({
                    id: atendimentos.id,
                    data: dataStr,
                    hora_inicio: atendimentos.hora_inicio,
                    hora_fim: atendimentos.hora_fim,
                    status: atendimentos.status,
                    id_profissional: atendimentos.id_profissional,
                    profissional_nome: usuarios.nome,
                    profissional_cor: usuarios.cor,
                    id_sala: atendimentos.id_sala,
                    sala_nome: salas.nome,
                    id_pessoa: atendimentos.id_pessoa,
                    pessoa_nome: pessoas.nome,
                    pessoa_telefone: pessoas.telefone,
                    id_venda: atendimentos.id_venda,
                    id_recorrencia: atendimentos.id_recorrencia,
                    observacoes: atendimentos.observacoes,
                    confirmado_em: atendimentos.confirmado_em,
                    lembrete_enviado_em: atendimentos.lembrete_enviado_em,
                    venda_rotulo: sql<string | null>`COALESCE(${rotuloItensAtendimento(atendimentos.id)}, ${rotuloVenda(atendimentos.id_venda)})`,
                    itens_ids: sql<string | null>`(SELECT GROUP_CONCAT(aiz.id_venda_item) FROM atendimento_itens aiz WHERE aiz.id_atendimento = ${atendimentos.id})`,
                    id_venda_item: atendimentos.id_venda_item,
                    titulo_extra: atendimentos.titulo_extra,
                    duracao_extra: atendimentos.duracao_extra,
                    id_venda_extra: atendimentos.id_venda_extra,
                    falta_consome: atendimentos.falta_consome,
                })
                .from(atendimentos)
                .innerJoin(usuarios, eq(usuarios.id, atendimentos.id_profissional))
                .innerJoin(pessoas, eq(pessoas.id, atendimentos.id_pessoa))
                .leftJoin(salas, eq(salas.id, atendimentos.id_sala))
                .where(and(...parts))
                .orderBy(atendimentos.data, atendimentos.hora_inicio);

            const ids = rows.map((r) => r.id);
            const servs = ids.length
                ? await ctx.db
                      .select({ id_atendimento: atendimentoServicos.id_atendimento, id: servicos.id, nome: servicos.nome, duracao: atendimentoServicos.duracao_minutos })
                      .from(atendimentoServicos)
                      .innerJoin(servicos, eq(servicos.id, atendimentoServicos.id_servico))
                      .where(inArray(atendimentoServicos.id_atendimento, ids))
                : [];
            const porAtendimento = new Map<number, { id: number; nome: string; duracao: number }[]>();
            for (const s of servs) {
                const l = porAtendimento.get(s.id_atendimento) ?? [];
                l.push({ id: s.id, nome: s.nome, duracao: s.duracao });
                porAtendimento.set(s.id_atendimento, l);
            }

            const admin = isAdmin(ctx.session);
            const atends = rows.map((r) => {
                const restrito = !admin && r.id_profissional !== ctx.session.id;
                return {
                    ...r,
                    hora_inicio: r.hora_inicio.slice(0, 5),
                    hora_fim: r.hora_fim.slice(0, 5),
                    restrito,
                    servicos: restrito ? [] : porAtendimento.get(r.id) ?? [],
                    ...(restrito
                        ? { pessoa_nome: 'Ocupado', pessoa_telefone: null, id_pessoa: 0, observacoes: null, id_venda: null, id_venda_item: null, venda_rotulo: null, itens_ids: null, titulo_extra: null, id_venda_extra: null }
                        : {}),
                };
            });

            const bloqueios = await ctx.db
                .select({
                    id: agendaBloqueios.id,
                    id_profissional: agendaBloqueios.id_profissional,
                    id_sala: agendaBloqueios.id_sala,
                    inicio: agendaBloqueios.inicio,
                    fim: agendaBloqueios.fim,
                    motivo: agendaBloqueios.motivo,
                })
                .from(agendaBloqueios)
                .where(
                    and(
                        eq(agendaBloqueios.id_unidade, ctx.session.unidadeId),
                        lte(agendaBloqueios.inicio, `${input.ate} 23:59:59`),
                        gte(agendaBloqueios.fim, `${input.de} 00:00:00`),
                    ),
                );

            const horarios = await ctx.db
                .select({
                    id_profissional: profissionalHorarios.id_profissional,
                    dia_semana: profissionalHorarios.dia_semana,
                    hora_inicio: profissionalHorarios.hora_inicio,
                    hora_fim: profissionalHorarios.hora_fim,
                })
                .from(profissionalHorarios)
                .innerJoin(usuarios, eq(usuarios.id, profissionalHorarios.id_profissional))
                .where(and(eq(usuarios.id_unidade, ctx.session.unidadeId), eq(usuarios.ativo, true)));

            return {
                atendimentos: atends,
                bloqueios,
                horarios: horarios.map((h) => ({ ...h, hora_inicio: h.hora_inicio.slice(0, 5), hora_fim: h.hora_fim.slice(0, 5) })),
            };
        }),

    /** Horários livres para sugerir no formulário. */
    disponibilidade: protectedProcedure
        .input(z.object({ id_profissional: zId, data: zData, duracao: z.number().int().min(5).max(600), id_sala: zId.nullable().optional(), ignorarId: zId.optional() }))
        .query(async ({ ctx, input }) => {
            const [u] = await ctx.db
                .select({ passo: usuarios.intervalo_agenda_min })
                .from(usuarios)
                .where(and(eq(usuarios.id, input.id_profissional), eq(usuarios.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!u) erro('NOT_FOUND', 'Profissional não encontrado');
            const c = await carregarContexto(ctx.db, {
                unidadeId: ctx.session.unidadeId,
                datas: [input.data],
                idProfissional: input.id_profissional,
                idSala: input.id_sala ?? null,
            });
            return horariosLivres({
                data: input.data,
                duracao: input.duracao,
                passo: u.passo,
                id_profissional: input.id_profissional,
                id_sala: input.id_sala ?? null,
                horarios: c.horarios,
                existentes: c.existentes.filter((e) => e.id !== input.ignorarId),
                bloqueios: c.bloqueios,
                compartilhados: c.compartilhados,
            });
        }),

    /** Itens (serviços e pacotes) das vendas ativas do cliente com sessões ainda disponíveis. */
    vendasDoCliente: protectedProcedure.input(z.object({ id_pessoa: zId, id_profissional: zId.optional(), id_atendimento: zId.optional() })).query(async ({ ctx, input }) => {
        // Editando: as sessões deste atendimento não contam como usadas
        const ignorar = input.id_atendimento ? sql`AND ax.id <> ${input.id_atendimento}` : sql``;
        // Só vendas do profissional do atendimento (as sem dono, legado, só para o admin)
        const idProf = isAdmin(ctx.session) ? input.id_profissional ?? ctx.session.id : ctx.session.id;
        const rows = await ctx.db
            .select({
                id: vendaItens.id,
                id_venda: vendas.id,
                data_venda: vendas.data_venda,
                quantidade_sessoes: vendaItens.quantidade_sessoes,
                id_servico: sql<number | null>`COALESCE(${vendaItens.id_servico}, ${pacotes.id_servico})`,
                pacote: sql<number>`${vendaItens.id_pacote} IS NOT NULL`,
                rotulo: sql<string>`COALESCE(${pacotes.nome}, (SELECT s2.nome FROM servicos s2 WHERE s2.id = ${vendaItens.id_servico}), 'Venda')`,
                servico_nome: sql<string | null>`(SELECT s3.nome FROM servicos s3 WHERE s3.id = COALESCE(${vendaItens.id_servico}, ${pacotes.id_servico}))`,
                duracao: sql<number | null>`(SELECT s4.duracao_minutos FROM servicos s4 WHERE s4.id = COALESCE(${vendaItens.id_servico}, ${pacotes.id_servico}))`,
                /** Pagamento da venda: PAGO, PENDENTE ou ATRASADO (parcela vencida em aberto). */
                pagamento: sql<'PAGO' | 'PENDENTE' | 'ATRASADO' | null>`(SELECT CASE
                        WHEN COUNT(*) = 0 THEN NULL
                        WHEN SUM(fz.status = 'PENDENTE' AND fz.data_vencimento < CURDATE()) > 0 THEN 'ATRASADO'
                        WHEN SUM(fz.status = 'PENDENTE') > 0 THEN 'PENDENTE'
                        ELSE 'PAGO' END
                    FROM financeiro fz WHERE fz.id_venda = ${vendas.id} AND fz.status <> 'CANCELADO')`,
                usadas: sql<number>`(SELECT COUNT(*) FROM atendimento_itens aix JOIN atendimentos ax ON ax.id = aix.id_atendimento WHERE aix.id_venda_item = ${vendaItens.id} AND ${CONSOME_SESSAO} ${ignorar})`,
            })
            .from(vendaItens)
            .innerJoin(vendas, eq(vendas.id, vendaItens.id_venda))
            .leftJoin(pacotes, eq(pacotes.id, vendaItens.id_pacote))
            .where(
                and(
                    eq(vendas.id_pessoa, input.id_pessoa),
                    eq(vendas.id_unidade, ctx.session.unidadeId),
                    eq(vendas.status, 'ATIVA'),
                    // Item livre (avaliação, retoque…) não é sessão para agendar
                    or(isNotNull(vendaItens.id_servico), isNotNull(vendaItens.id_pacote)),
                    isNull(vendas.deleted_at),
                    isAdmin(ctx.session)
                        ? or(eq(vendas.id_profissional, idProf), isNull(vendas.id_profissional))
                        : eq(vendas.id_profissional, idProf),
                ),
            )
            .orderBy(vendas.data_venda, vendaItens.id);
        return rows
            .map((r) => ({ ...r, pacote: Boolean(Number(r.pacote)), usadas: Number(r.usadas), restantes: r.quantidade_sessoes - Number(r.usadas) }))
            .filter((r) => r.restantes > 0);
    }),

    /** Cadastro rápido de cliente direto da agenda. */
    clienteRapido: protectedProcedure
        .input(z.object({ nome: z.string().trim().min(2).max(150), telefone: z.string().max(25).optional() }))
        .mutation(async ({ ctx, input }) => {
            const [r] = await ctx.db
                .insert(pessoas)
                .values({ id_unidade: ctx.session.unidadeId, tipo: 'CLIENTE', nome: input.nome, telefone: telefoneValido(input.telefone) })
                .$returningId();
            await vincularPessoa(ctx.db, r!.id, ctx.session.id);
            return { id: r!.id, nome: input.nome, telefone: telefoneValido(input.telefone) };
        }),

    criar: protectedProcedure
        .input(
            z.object({
                id_pessoa: zId,
                id_profissional: zId.optional(),
                id_sala: zId.nullable().optional(),
                data: zData,
                hora_inicio: zHora,
                hora_fim: zHora.optional(),
                /** Serviços da sessão (duração, nomes e WhatsApp). */
                servicos: z.array(zId).default([]),
                /** Serviço sem cadastro: título e duração (cobrança vai em `venda`). */
                titulo_livre: z.string().trim().max(120).optional(),
                duracao_livre: z.number().int().min(5).max(600).optional(),
                /** Itens já comprados que esta sessão usa (desconta 1 de cada). */
                usar_itens: z.array(zId).default([]),
                /** Compatibilidade: um item só. */
                id_venda_item: zId.nullable().optional(),
                /** Venda feita agora (serviços, pacotes, sem cadastro) e pagamento. */
                venda: zVendaAgenda.optional(),
                observacoes: z.string().max(2000).optional(),
                recorrencia: zRecorrencia.optional(),
                forcar: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const s = ctx.session;
            const idProf = input.id_profissional ?? s.id;
            assertPodeGerenciar(s, idProf);
            await assertProfissional(ctx.db, s.unidadeId, idProf);
            await assertSala(ctx.db, s.unidadeId, input.id_sala);

            const [cliente] = await ctx.db
                .select({ id: pessoas.id })
                .from(pessoas)
                .where(and(eq(pessoas.id, input.id_pessoa), eq(pessoas.id_unidade, s.unidadeId), isNull(pessoas.deleted_at)))
                .limit(1);
            if (!cliente) erro('NOT_FOUND', 'Cliente não encontrado');
            if (!isAdmin(s)) await assertAcessoPessoa(ctx.db, s, input.id_pessoa);

            const usar = input.usar_itens.length ? input.usar_itens : input.id_venda_item ? [input.id_venda_item] : [];
            const titulo = input.titulo_livre?.trim() || null;
            if (!input.servicos.length && !titulo && !usar.length && !input.venda?.itens.length)
                erro('BAD_REQUEST', 'Escolha um serviço para o agendamento');
            const servs = await carregarServicos(ctx.db, input.servicos, idProf);
            const inicio = hhmmParaMin(input.hora_inicio);
            const duracoes = [...servs.map((x) => x.duracao), ...(titulo && input.duracao_livre ? [input.duracao_livre] : [])];
            const fim = input.hora_fim ? hhmmParaMin(input.hora_fim) : calcularFim(inicio, duracoes.length ? duracoes : [60]);
            if (fim <= inicio) erro('BAD_REQUEST', 'O horário final deve ser depois do inicial');

            const datas = input.recorrencia
                ? gerarOcorrencias(input.data, input.recorrencia.quantidade, input.recorrencia.intervalo_semanas)
                : [input.data];
            const idSala = input.id_sala ?? null;

            return ctx.db.transaction(async (tx) => {
                const c = await carregarContexto(tx, { unidadeId: s.unidadeId, datas, idProfissional: idProf, idSala, travar: true });

                const livres: string[] = [];
                const puladas: { data: string; motivo: string }[] = [];
                for (const data of datas) {
                    const conflitos = conflitosImpeditivos(
                        verificarConflitos({ novo: { data, inicio, fim, id_profissional: idProf, id_sala: idSala }, ...c }),
                        { isAdmin: isAdmin(s), forcar: input.forcar },
                    );
                    if (conflitos.length) puladas.push({ data, motivo: mensagemConflitos(conflitos) });
                    else livres.push(data);
                }

                if (!input.recorrencia && puladas.length) erro('CONFLICT', puladas[0].motivo);
                if (!livres.length) erro('CONFLICT', 'Nenhuma data livre: ' + puladas.map((p) => `${p.data} (${p.motivo})`).join('; '));

                const jaComprados = await validarItens(tx, s.unidadeId, usar, input.id_pessoa, livres.length, idProf);

                let idRecorrencia: number | null = null;
                if (input.recorrencia) {
                    const [r] = await tx
                        .insert(agendaRecorrencias)
                        .values({ intervalo_semanas: input.recorrencia.intervalo_semanas, quantidade: livres.length, criado_por: s.id })
                        .$returningId();
                    idRecorrencia = r!.id;
                }

                await vincularPessoa(tx, input.id_pessoa, idProf);
                const vendido = input.venda ? await venderNoAgendamento(tx, s, input.venda, input.id_pessoa, idProf, livres) : null;

                const criados: number[] = [];
                for (const [i, data] of livres.entries()) {
                    const [r] = await tx
                        .insert(atendimentos)
                        .values({
                            id_unidade: s.unidadeId,
                            id_pessoa: input.id_pessoa,
                            titulo_extra: titulo,
                            duracao_extra: titulo ? input.duracao_livre ?? null : null,
                            id_venda_extra: null,
                            id_profissional: idProf,
                            id_sala: idSala,
                            id_recorrencia: idRecorrencia,
                            data: dataParaDate(data),
                            hora_inicio: hora(inicio),
                            hora_fim: hora(fim),
                            status: 'AGENDADO',
                            observacoes: input.observacoes,
                            criado_por: s.id,
                        })
                        .$returningId();
                    criados.push(r!.id);
                    const novosDaData = (vendido?.itens ?? []).filter((it) => it.datas.includes(i)).map((it) => ({ id: it.id, id_venda: vendido!.idVenda! }));
                    await ligarItens(tx, r!.id, [...jaComprados, ...novosDaData]);
                    if (servs.length)
                        await tx.insert(atendimentoServicos).values(
                            servs.map((sv) => ({ id_atendimento: r!.id, id_servico: sv.id, duracao_minutos: sv.duracao, valor: String(sv.valor) })),
                        );
                }
                return { ids: criados, puladas, id_venda: vendido?.idVenda ?? null };
            });
        }),

    /** Reagendar / mover / trocar sala, profissional, serviços ou itens usados; pode vender itens novos. */
    atualizar: protectedProcedure
        .input(
            z.object({
                id: zId,
                data: zData.optional(),
                hora_inicio: zHora.optional(),
                hora_fim: zHora.optional(),
                id_profissional: zId.optional(),
                id_sala: zId.nullable().optional(),
                servicos: z.array(zId).optional(),
                /** Serviço sem cadastro: string define, null tira. */
                titulo_livre: z.string().trim().max(120).nullable().optional(),
                duracao_livre: z.number().int().min(5).max(600).nullable().optional(),
                /** Itens já comprados usados (substitui os atuais). */
                usar_itens: z.array(zId).optional(),
                /** Compatibilidade: um item só (null desvincula). */
                id_venda_item: zId.nullable().optional(),
                /** Itens novos vendidos agora → nova venda. */
                venda: zVendaAgenda.optional(),
                observacoes: z.string().max(2000).nullable().optional(),
                forcar: z.boolean().optional(),
                /** Aplicar também às próximas ocorrências da recorrência. */
                aplicarProximas: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const s = ctx.session;
            return ctx.db.transaction(async (tx) => {
                const atual = await buscarAtendimento(tx, s.unidadeId, input.id);
                assertPodeGerenciar(s, atual.id_profissional);
                if (!STATUS_ABERTOS.includes(atual.status)) erro('CONFLICT', 'Só é possível alterar atendimentos agendados ou confirmados');

                const idProf = input.id_profissional ?? atual.id_profissional;
                assertPodeGerenciar(s, idProf);
                if (idProf !== atual.id_profissional) await assertProfissional(tx, s.unidadeId, idProf);
                const idSala = input.id_sala !== undefined ? input.id_sala : atual.id_sala;
                if (input.id_sala !== undefined) await assertSala(tx, s.unidadeId, idSala);

                const servs = input.servicos ? await carregarServicos(tx, input.servicos, idProf) : null;
                if (!servs && idProf !== atual.id_profissional) {
                    // trocando de profissional: os serviços atuais precisam servir para o novo
                    const atuais = await tx
                        .select({ nome: servicos.nome, dono: servicos.id_profissional })
                        .from(atendimentoServicos)
                        .innerJoin(servicos, eq(servicos.id, atendimentoServicos.id_servico))
                        .where(eq(atendimentoServicos.id_atendimento, atual.id));
                    const usaClinica = await usaServicosClinica(tx, idProf);
                    const deOutro = atuais.find((x) => !servicoServeParaProfissional(x.dono, idProf, usaClinica));
                    if (deOutro) erro('BAD_REQUEST', `"${deOutro.nome}" é um serviço próprio de outro profissional`);
                }
                const inicioAtual = hhmmParaMin(atual.hora_inicio);
                const duracaoAtual = hhmmParaMin(atual.hora_fim) - inicioAtual;
                const inicio = input.hora_inicio ? hhmmParaMin(input.hora_inicio) : inicioAtual;
                const fim = input.hora_fim
                    ? hhmmParaMin(input.hora_fim)
                    : servs && servs.length
                      ? calcularFim(inicio, servs.map((x) => x.duracao))
                      : inicio + duracaoAtual;
                if (fim <= inicio) erro('BAD_REQUEST', 'O horário final deve ser depois do inicial');

                const novaData = input.data ?? atual.data;
                const deltaDias = Math.round((Date.parse(`${novaData}T00:00:00Z`) - Date.parse(`${atual.data}T00:00:00Z`)) / 86_400_000);

                // alvos: este atendimento (+ próximos da série, se pedido)
                let alvos: { id: number; data: string }[] = [{ id: atual.id, data: novaData }];
                if (input.aplicarProximas && atual.id_recorrencia) {
                    const proximos = await tx
                        .select({ id: atendimentos.id, data: dataStr })
                        .from(atendimentos)
                        .where(
                            and(
                                eq(atendimentos.id_recorrencia, atual.id_recorrencia),
                                gt(atendimentos.data, dataParaDate(atual.data)),
                                inArray(atendimentos.status, STATUS_ABERTOS),
                            ),
                        );
                    alvos = alvos.concat(proximos.map((p) => ({ id: p.id, data: somarDias(p.data, deltaDias) })));
                }

                // Itens já comprados: lista nova substitui a atual
                const usar = input.usar_itens ?? (input.id_venda_item !== undefined ? (input.id_venda_item ? [input.id_venda_item] : []) : undefined);
                const jaComprados = usar
                    ? await validarItens(tx, s.unidadeId, usar, atual.id_pessoa, alvos.length, idProf, alvos.map((a) => a.id))
                    : null;

                const c = await carregarContexto(tx, { unidadeId: s.unidadeId, datas: alvos.map((a) => a.data), idProfissional: idProf, idSala, travar: true });
                const idsAlvo = new Set(alvos.map((a) => a.id));
                const existentes = c.existentes.filter((e) => !idsAlvo.has(e.id));
                for (const alvo of alvos) {
                    const conflitos = conflitosImpeditivos(
                        verificarConflitos({ novo: { data: alvo.data, inicio, fim, id_profissional: idProf, id_sala: idSala }, existentes, bloqueios: c.bloqueios, horarios: c.horarios, compartilhados: c.compartilhados }),
                        { isAdmin: isAdmin(s), forcar: input.forcar },
                    );
                    if (conflitos.length) erro('CONFLICT', `${alvo.data.split('-').reverse().join('/')}: ${mensagemConflitos(conflitos)}`);
                }

                // Itens novos vendidos na edição → nova venda
                const vendido = input.venda ? await venderNoAgendamento(tx, s, input.venda, atual.id_pessoa, idProf, alvos.map((a) => a.data)) : null;

                const livreSet =
                    input.titulo_livre === undefined
                        ? {}
                        : { titulo_extra: input.titulo_livre?.trim() || null, duracao_extra: input.titulo_livre ? input.duracao_livre ?? null : null };

                for (const [i, alvo] of alvos.entries()) {
                    await tx
                        .update(atendimentos)
                        .set({
                            data: dataParaDate(alvo.data),
                            hora_inicio: hora(inicio),
                            hora_fim: hora(fim),
                            id_profissional: idProf,
                            id_sala: idSala,
                            ...livreSet,
                            ...(input.observacoes !== undefined && alvo.id === atual.id ? { observacoes: input.observacoes } : {}),
                            updated_at: new Date(),
                        })
                        .where(eq(atendimentos.id, alvo.id));
                    if (jaComprados || vendido) {
                        const base = jaComprados ?? (await itensDoAtendimento(tx, alvo.id));
                        const novos = (vendido?.itens ?? []).filter((it) => it.datas.includes(i)).map((it) => ({ id: it.id, id_venda: vendido!.idVenda! }));
                        await ligarItens(tx, alvo.id, [...base, ...novos]);
                    }
                    if (servs) {
                        await tx.delete(atendimentoServicos).where(eq(atendimentoServicos.id_atendimento, alvo.id));
                        if (servs.length)
                            await tx.insert(atendimentoServicos).values(
                                servs.map((sv) => ({ id_atendimento: alvo.id, id_servico: sv.id, duracao_minutos: sv.duracao, valor: String(sv.valor) })),
                            );
                    }
                }
                return { ok: true, atualizados: alvos.length, id_venda: vendido?.idVenda ?? null };
            });
        }),

    alterarStatus: protectedProcedure
        .input(
            z.object({
                id: zId,
                status: z.enum(['CONFIRMADO', 'REALIZADO', 'FALTOU', 'CANCELADO']),
                motivo: z.string().max(255).optional(),
                /** Falta com regra "perguntar": desconta a sessão do pacote? */
                consumirSessao: z.boolean().optional(),
                /** Cancelar também as próximas da recorrência. */
                aplicarProximas: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const s = ctx.session;
            const a = await buscarAtendimento(ctx.db, s.unidadeId, input.id);
            assertPodeGerenciar(s, a.id_profissional);
            if (!STATUS_ABERTOS.includes(a.status)) erro('CONFLICT', `Atendimento já está ${a.status.toLowerCase()}`);
            if (input.status === 'CONFIRMADO' && a.status === 'CONFIRMADO') return { ok: true, atualizados: 0 };

            // Falta: a regra decide se a sessão do pacote é descontada
            let consome = false;
            if (input.status === 'FALTOU' && a.id_venda_item) {
                const regra = await regraFaltaDoProfissional(ctx.db, s.unidadeId, a.id_profissional);
                const r = faltaConsome(regra, input.consumirSessao);
                if (r === null) erro('BAD_REQUEST', 'Informe se a falta desconta a sessão do pacote');
                consome = r;
            }

            const set = {
                status: input.status,
                falta_consome: consome,
                updated_at: new Date(),
                ...(input.status === 'CONFIRMADO' ? { confirmado_em: new Date() } : {}),
                ...(input.status === 'CANCELADO' ? { motivo_cancelamento: input.motivo ?? null } : {}),
            };
            let where = eq(atendimentos.id, a.id);
            if (input.status === 'CANCELADO' && input.aplicarProximas && a.id_recorrencia) {
                where = or(
                    eq(atendimentos.id, a.id),
                    and(
                        eq(atendimentos.id_recorrencia, a.id_recorrencia),
                        gt(atendimentos.data, dataParaDate(a.data)),
                        inArray(atendimentos.status, STATUS_ABERTOS),
                    ),
                )!;
            }
            const [res] = await ctx.db.update(atendimentos).set(set).where(where);
            return { ok: true, atualizados: res.affectedRows };
        }),

    /** Mensagem e link de WhatsApp para um atendimento. */
    whatsapp: protectedProcedure
        .input(z.object({ id: zId, tipo: z.enum(['CONFIRMACAO', 'LEMBRETE']) }))
        .query(async ({ ctx, input }) => {
            const a = await dadosMensagem(ctx.db, ctx.session.unidadeId, input.id);
            assertPodeGerenciar(ctx.session, a.id_profissional);
            return montarWhatsApp(input.tipo, a);
        }),

    /** Atendimentos do dia (padrão: amanhã) para enviar lembrete. */
    lembretes: protectedProcedure.input(z.object({ data: zData })).query(async ({ ctx, input }) => {
        const parts = [
            eq(atendimentos.id_unidade, ctx.session.unidadeId),
            sql`${atendimentos.data} = ${input.data}`,
            inArray(atendimentos.status, STATUS_ABERTOS),
        ];
        if (!isAdmin(ctx.session)) parts.push(eq(atendimentos.id_profissional, ctx.session.id));
        const rows = await ctx.db
            .select({ id: atendimentos.id, lembrete_enviado_em: atendimentos.lembrete_enviado_em, status: atendimentos.status })
            .from(atendimentos)
            .where(and(...parts))
            .orderBy(atendimentos.hora_inicio);
        return Promise.all(
            rows.map(async (r) => {
                const d = await dadosMensagem(ctx.db, ctx.session.unidadeId, r.id);
                return {
                    id: r.id,
                    status: r.status,
                    lembrete_enviado_em: r.lembrete_enviado_em,
                    cliente: d.cliente,
                    profissional: d.profissional,
                    hora: d.hora_inicio.slice(0, 5),
                    servicos: d.servicos,
                    ...montarWhatsApp('LEMBRETE', d),
                };
            }),
        );
    }),

    marcarLembreteEnviado: protectedProcedure.input(z.object({ id: zId })).mutation(async ({ ctx, input }) => {
        const a = await buscarAtendimento(ctx.db, ctx.session.unidadeId, input.id);
        assertPodeGerenciar(ctx.session, a.id_profissional);
        await ctx.db.update(atendimentos).set({ lembrete_enviado_em: new Date() }).where(eq(atendimentos.id, a.id));
        return { ok: true };
    }),
});
