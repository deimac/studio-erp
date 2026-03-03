import { TRPCError } from '@trpc/server';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
    agendaConfiguracao,
    vendas,
    atendimentos,
    pessoas,
    servicos,
    pacotes,
    usuarios,
} from '../../drizzle/schema';
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
                status: z.enum(['AGENDADO', 'REALIZADO', 'CANCELADO', 'FALTOU']).optional(),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts = [eq(vendas.id_unidade, ctx.session.unidadeId)];
            if (input?.de) whereParts.push(gte(atendimentos.data, normalizeDateOnly(input.de)));
            if (input?.ate) whereParts.push(lte(atendimentos.data, normalizeDateOnly(input.ate)));
            if (input?.status) whereParts.push(eq(atendimentos.status, input.status));
            if (input?.id_venda) whereParts.push(eq(atendimentos.id_venda, input.id_venda));

            if (ctx.session.perfil === 'PROFISSIONAL') {
                whereParts.push(eq(atendimentos.id_profissional, ctx.session.id));
            } else if (input?.profissionalId) {
                whereParts.push(eq(atendimentos.id_profissional, input.profissionalId));
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
                    servico_nome: sql<string | null>`${servicos.nome}`.as('servico_nome'),
                    pacote_nome: sql<string | null>`${pacotes.nome}`.as('pacote_nome'),
                    profissional_nome: sql<string>`${usuarios.nome}`.as('profissional_nome'),
                })
                .from(atendimentos)
                .innerJoin(vendas, eq(atendimentos.id_venda, vendas.id))
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(servicos, eq(vendas.id_servico, servicos.id))
                .leftJoin(pacotes, eq(vendas.id_pacote, pacotes.id))
                .innerJoin(usuarios, eq(atendimentos.id_profissional, usuarios.id))
                .where(and(...whereParts))
                .orderBy(atendimentos.data, atendimentos.hora_inicio);
        }),

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

            // Validate profissional
            const [prof] = await ctx.db.select({ id: usuarios.id, ativo: usuarios.ativo })
                .from(usuarios)
                .where(and(eq(usuarios.id, profId), eq(usuarios.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!prof?.ativo) throw new TRPCError({ code: 'FORBIDDEN', message: 'Profissional inválido/inativo' });

            // Validate venda
            const [vd] = await ctx.db
                .select({
                    id: vendas.id,
                    status: vendas.status,
                    quantidade_sessoes: vendas.quantidade_sessoes,
                })
                .from(vendas)
                .where(and(eq(vendas.id, input.id_venda), eq(vendas.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!vd) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
            if (vd.status !== 'ATIVA') throw new TRPCError({ code: 'CONFLICT', message: 'Venda não está ativa' });

            const ids = await ctx.db.insert(atendimentos).values({
                id_venda: input.id_venda,
                id_profissional: profId,
                data: normalizeDateOnly(input.data),
                hora_inicio: normalizeTime(input.hora_inicio),
                hora_fim: normalizeTime(input.hora_fim),
                status: 'AGENDADO',
                observacoes: input.observacoes,
            }).$returningId();

            return { id: ids[0]?.id };
        }),

    cancelar: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const [a] = await ctx.db
                .select({ id: atendimentos.id, status: atendimentos.status, id_profissional: atendimentos.id_profissional })
                .from(atendimentos)
                .innerJoin(vendas, eq(atendimentos.id_venda, vendas.id))
                .where(and(eq(atendimentos.id, input.id), eq(vendas.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (a.status !== 'AGENDADO') throw new TRPCError({ code: 'CONFLICT', message: 'Apenas AGENDADO pode ser cancelado' });

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
                .innerJoin(vendas, eq(atendimentos.id_venda, vendas.id))
                .where(and(eq(atendimentos.id, input.id), eq(vendas.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (a.status !== 'AGENDADO') throw new TRPCError({ code: 'CONFLICT', message: 'Apenas AGENDADO pode ser confirmado' });

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
                .innerJoin(vendas, eq(atendimentos.id_venda, vendas.id))
                .where(and(eq(atendimentos.id, input.id), eq(vendas.id_unidade, ctx.session.unidadeId)))
                .limit(1);
            if (!a) throw new TRPCError({ code: 'NOT_FOUND', message: 'Atendimento não encontrado' });
            if (a.status !== 'AGENDADO') throw new TRPCError({ code: 'CONFLICT', message: 'Apenas AGENDADO pode ser alterado' });

            if (ctx.session.perfil === 'PROFISSIONAL' && a.id_profissional !== ctx.session.id)
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });

            await ctx.db.update(atendimentos).set({ status: 'FALTOU', updated_at: new Date() }).where(eq(atendimentos.id, input.id));
            return { ok: true };
        }),
});
