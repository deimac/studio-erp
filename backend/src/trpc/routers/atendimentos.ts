import { TRPCError } from '@trpc/server';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
    agendaConfiguracao,
    agendaBloqueios,
    atendimentoServicos,
    vendas,
    atendimentos,
    pessoas,
    servicos,
    pacotes,
    profissionalHorarios,
    usuarios,
    vendaItens,
} from '../../drizzle/schema';
import { CONSOME_SESSAO } from '../vendaItens';
import { conflitosImpeditivos, hhmmParaMin, verificarConflitos } from '../../lib/agenda';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

function normalizeTime(v: string) {
    return v.length === 5 ? `${v}:00` : v;
}

function normalizeDateOnly(value: string) {
    const datePart = value.includes('T') ? value.split('T')[0] : value;
    const d = new Date(`${datePart}T00:00:00`);
    if (isNaN(d.getTime())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data inválida' });
    return d;
}

const STATUS = ['AGENDADO', 'CONFIRMADO', 'REALIZADO', 'CANCELADO', 'FALTOU'] as const;
const ABERTOS = ['AGENDADO', 'CONFIRMADO'] as const;

export const atendimentosRouter = createTRPCRouter({
    /* ============= Agenda ============= */
    agendaCriarSlots: protectedProcedure
        .input(
            z.object({
                hora_inicio: z.string().min(4),
                hora_fim: z.string().min(4),
                intervalo_minutos: z.union([z.literal(15), z.literal(30), z.literal(60)]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(agendaConfiguracao).where(eq(agendaConfiguracao.id_profissional, ctx.session.id));
            await ctx.db.insert(agendaConfiguracao).values({
                id_profissional: ctx.session.id,
                hora_inicio: normalizeTime(input.hora_inicio),
                hora_fim: normalizeTime(input.hora_fim),
                intervalo_minutos: input.intervalo_minutos,
            });
            // Compatibilidade: replica para o expediente semanal (seg–sex) da nova agenda
            await ctx.db.delete(profissionalHorarios).where(eq(profissionalHorarios.id_profissional, ctx.session.id));
            await ctx.db.insert(profissionalHorarios).values(
                [1, 2, 3, 4, 5].map((dia_semana) => ({
                    id_profissional: ctx.session.id,
                    dia_semana,
                    hora_inicio: normalizeTime(input.hora_inicio),
                    hora_fim: normalizeTime(input.hora_fim),
                })),
            );
            await ctx.db.update(usuarios).set({ intervalo_agenda_min: input.intervalo_minutos }).where(eq(usuarios.id, ctx.session.id));
            return { ok: true };
        }),

    agendaListar: protectedProcedure
        .input(z.object({ profissionalId: z.number().int().positive().optional() }).optional())
        .query(async ({ ctx, input }) => {
            const profId = input?.profissionalId ?? ctx.session.id;
            return ctx.db.select().from(agendaConfiguracao).where(eq(agendaConfiguracao.id_profissional, profId));
        }),

    /* ============= Atendimentos ============= */
    list: protectedProcedure
        .input(
            z.object({
                de: z.string().min(1).optional(),
                ate: z.string().min(1).optional(),
                profissionalId: z.number().int().positive().optional(),
                id_venda: z.number().int().positive().optional(),
                status: z.enum(STATUS).optional(),
                escopo: z.enum(['GERAL', 'MEU']).optional(),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts = [eq(atendimentos.id_unidade, ctx.session.unidadeId)];
            if (input?.de) whereParts.push(gte(atendimentos.data, normalizeDateOnly(input.de)));
            if (input?.ate) whereParts.push(lte(atendimentos.data, normalizeDateOnly(input.ate)));
            if (input?.status) whereParts.push(eq(atendimentos.status, input.status));
            if (input?.id_venda) whereParts.push(eq(atendimentos.id_venda, input.id_venda));

            if (ctx.session.perfil === 'PROFISSIONAL') {
                whereParts.push(eq(atendimentos.id_profissional, ctx.session.id));
            } else if (input?.profissionalId) {
                whereParts.push(eq(atendimentos.id_profissional, input.profissionalId));
            } else if (input?.escopo === 'MEU') {
                whereParts.push(eq(atendimentos.id_profissional, ctx.session.id));
            }

            return ctx.db
                .select({
                    id: atendimentos.id,
                    id_venda: atendimentos.id_venda,
                    id_profissional: atendimentos.id_profissional,
                    data: atendimentos.data,
                    hora_inicio: atendimentos.hora_inicio,
                    hora_fim: atendimentos.hora_fim,
                    status: atendimentos.status,
                    observacoes: atendimentos.observacoes,
                    created_at: atendimentos.created_at,
                    // Joined data
                    pessoa_nome: sql<string>`${pessoas.nome}`.as('pessoa_nome'),
                    servico_nome: sql<string | null>`COALESCE(NULLIF(CONCAT_WS(', ', (SELECT GROUP_CONCAT(sx.nome ORDER BY sx.nome SEPARATOR ', ') FROM atendimento_servicos x JOIN servicos sx ON sx.id = x.id_servico WHERE x.id_atendimento = ${atendimentos.id}), ${atendimentos.titulo_extra}), ''), ${servicos.nome})`.as('servico_nome'),
                    pacote_nome: sql<string | null>`COALESCE((SELECT pz.nome FROM venda_itens vz JOIN pacotes pz ON pz.id = vz.id_pacote WHERE vz.id = ${atendimentos.id_venda_item}), ${pacotes.nome})`.as('pacote_nome'),
                    profissional_nome: sql<string>`${usuarios.nome}`.as('profissional_nome'),
                })
                .from(atendimentos)
                .leftJoin(vendas, eq(atendimentos.id_venda, vendas.id))
                .innerJoin(pessoas, eq(atendimentos.id_pessoa, pessoas.id))
                .leftJoin(servicos, eq(vendas.id_servico, servicos.id))
                .leftJoin(pacotes, eq(vendas.id_pacote, pacotes.id))
                .innerJoin(usuarios, eq(atendimentos.id_profissional, usuarios.id))
                .where(and(...whereParts))
                .orderBy(atendimentos.data, atendimentos.hora_inicio);
        }),

    /** Agendamento a partir de uma venda (fluxo antigo). A nova agenda usa agenda.criar. */
    create: protectedProcedure
        .input(
            z.object({
                id_venda: z.number().int().positive(),
                id_profissional: z.number().int().positive().optional(),
                data: z.string().min(1),
                hora_inicio: z.string().min(4),
                hora_fim: z.string().min(4),
                observacoes: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const profId = input.id_profissional ?? ctx.session.id;
            if (ctx.session.perfil === 'PROFISSIONAL' && profId !== ctx.session.id)
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Você só pode agendar na sua própria agenda' });

            const [prof] = await ctx.db.select({ id: usuarios.id, ativo: usuarios.ativo })
                .from(usuarios)
                .where(and(eq(usuarios.id, profId), eq(usuarios.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!prof?.ativo) throw new TRPCError({ code: 'FORBIDDEN', message: 'Profissional inválido/inativo' });

            const [vd] = await ctx.db
                .select({
                    id: vendas.id,
                    status: vendas.status,
                    id_pessoa: vendas.id_pessoa,
                    id_servico: sql<number | null>`COALESCE(${vendas.id_servico}, ${pacotes.id_servico})`,
                })
                .from(vendas)
                .leftJoin(pacotes, eq(pacotes.id, vendas.id_pacote))
                .where(and(eq(vendas.id, input.id_venda), eq(vendas.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!vd) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
            if (vd.status !== 'ATIVA') throw new TRPCError({ code: 'CONFLICT', message: 'Venda não está ativa' });

            // Item da venda com sessão disponível (venda pode ter vários serviços/pacotes)
            const itensVenda = await ctx.db
                .select({
                    id: vendaItens.id,
                    qtd: vendaItens.quantidade_sessoes,
                    // Nomes qualificados: em consulta de uma tabela só o Drizzle omite o prefixo
                    id_servico: sql<number | null>`COALESCE(venda_itens.id_servico, (SELECT pz.id_servico FROM pacotes pz WHERE pz.id = venda_itens.id_pacote))`,
                    usadas: sql<number>`(SELECT COUNT(*) FROM atendimentos ax WHERE ax.id_venda_item = venda_itens.id AND ${CONSOME_SESSAO})`,
                })
                .from(vendaItens)
                .where(eq(vendaItens.id_venda, input.id_venda))
                .orderBy(vendaItens.id);
            const item = itensVenda.find((i) => i.qtd - Number(i.usadas) > 0) ?? null;
            if (itensVenda.length && !item) throw new TRPCError({ code: 'CONFLICT', message: 'A venda não tem mais sessões disponíveis' });
            const idServicoSessao = item?.id_servico ?? vd.id_servico;

            const data = normalizeDateOnly(input.data);
            const dataTxt = input.data.slice(0, 10);
            const inicio = hhmmParaMin(input.hora_inicio);
            const fim = hhmmParaMin(input.hora_fim);
            if (fim <= inicio) throw new TRPCError({ code: 'BAD_REQUEST', message: 'O horário final deve ser depois do inicial' });

            return ctx.db.transaction(async (tx) => {
                const grupo = (await tx
                    .select({ id: usuarios.id })
                    .from(usuarios)
                    .where(and(eq(usuarios.id_unidade, ctx.session.unidadeId), eq(usuarios.ativo, true), eq(usuarios.agenda_compartilhada, true))))
                    .map((u) => u.id);
                const alvo = grupo.includes(profId) ? grupo : [profId];
                const existentes = await tx
                    .select({
                        id: atendimentos.id,
                        hora_inicio: atendimentos.hora_inicio,
                        hora_fim: atendimentos.hora_fim,
                        id_profissional: atendimentos.id_profissional,
                        id_sala: atendimentos.id_sala,
                        status: atendimentos.status,
                    })
                    .from(atendimentos)
                    .where(and(inArray(atendimentos.id_profissional, alvo), sql`${atendimentos.data} = ${dataTxt}`))
                    .for('update');
                const bloqueios = await tx
                    .select()
                    .from(agendaBloqueios)
                    .where(and(
                        eq(agendaBloqueios.id_unidade, ctx.session.unidadeId),
                        lte(agendaBloqueios.inicio, `${dataTxt} 23:59:59`),
                        gte(agendaBloqueios.fim, `${dataTxt} 00:00:00`),
                    ));
                const horarios = await tx.select().from(profissionalHorarios).where(eq(profissionalHorarios.id_profissional, profId));
                const conflitos = conflitosImpeditivos(
                    verificarConflitos({
                        novo: { data: dataTxt, inicio, fim, id_profissional: profId, id_sala: null },
                        existentes: existentes.map((e) => ({ ...e, data: dataTxt, inicio: hhmmParaMin(e.hora_inicio), fim: hhmmParaMin(e.hora_fim) })),
                        bloqueios,
                        horarios: horarios.map((h) => ({ dia_semana: h.dia_semana, inicio: hhmmParaMin(h.hora_inicio), fim: hhmmParaMin(h.hora_fim) })),
                        compartilhados: grupo,
                    }),
                    { isAdmin: ctx.session.perfil === 'ADMIN', forcar: true },
                );
                if (conflitos.length) throw new TRPCError({ code: 'CONFLICT', message: conflitos.map((c) => c.mensagem).join(' · ') });

                const ids = await tx.insert(atendimentos).values({
                    id_unidade: ctx.session.unidadeId,
                    id_pessoa: vd.id_pessoa,
                    id_venda: input.id_venda,
                    id_venda_item: item?.id ?? null,
                    id_profissional: profId,
                    data,
                    hora_inicio: normalizeTime(input.hora_inicio),
                    hora_fim: normalizeTime(input.hora_fim),
                    status: 'AGENDADO',
                    observacoes: input.observacoes,
                    criado_por: ctx.session.id,
                }).$returningId();
                const id = ids[0]!.id;

                if (idServicoSessao) {
                    const [sv] = await tx.select({ duracao: servicos.duracao_minutos, valor: servicos.valor }).from(servicos).where(eq(servicos.id, idServicoSessao)).limit(1);
                    if (sv) await tx.insert(atendimentoServicos).values({ id_atendimento: id, id_servico: idServicoSessao, duracao_minutos: sv.duracao, valor: String(sv.valor) });
                }
                return { id };
            });
        }),

    cancelar: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const [a] = await ctx.db
                .select({ id: atendimentos.id, status: atendimentos.status, id_profissional: atendimentos.id_profissional })
                .from(atendimentos)
                .where(and(eq(atendimentos.id, input.id), eq(atendimentos.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (!(ABERTOS as readonly string[]).includes(a.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Apenas agendado ou confirmado pode ser cancelado' });

            if (ctx.session.perfil === 'PROFISSIONAL' && a.id_profissional !== ctx.session.id)
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });

            await ctx.db.update(atendimentos).set({ status: 'CANCELADO', updated_at: new Date() }).where(eq(atendimentos.id, input.id));
            return { ok: true };
        }),

    marcarRealizado: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const [a] = await ctx.db
                .select({
                    id: atendimentos.id,
                    status: atendimentos.status,
                    id_profissional: atendimentos.id_profissional,
                    id_venda: atendimentos.id_venda,
                })
                .from(atendimentos)
                .where(and(eq(atendimentos.id, input.id), eq(atendimentos.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (!(ABERTOS as readonly string[]).includes(a.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Apenas agendado ou confirmado pode ser confirmado' });

            if (ctx.session.perfil === 'PROFISSIONAL' && a.id_profissional !== ctx.session.id)
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });

            await ctx.db.update(atendimentos).set({ status: 'REALIZADO', updated_at: new Date() }).where(eq(atendimentos.id, input.id));
            return { ok: true };
        }),

    marcarFaltou: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const [a] = await ctx.db
                .select({ id: atendimentos.id, status: atendimentos.status, id_profissional: atendimentos.id_profissional })
                .from(atendimentos)
                .where(and(eq(atendimentos.id, input.id), eq(atendimentos.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (!(ABERTOS as readonly string[]).includes(a.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Apenas agendado ou confirmado pode ser alterado' });

            if (ctx.session.perfil === 'PROFISSIONAL' && a.id_profissional !== ctx.session.id)
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });

            await ctx.db.update(atendimentos).set({ status: 'FALTOU', updated_at: new Date() }).where(eq(atendimentos.id, input.id));
            return { ok: true };
        }),
});
