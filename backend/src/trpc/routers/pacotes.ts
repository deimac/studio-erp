import { TRPCError } from '@trpc/server';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { pacotes, servicos } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export const pacotesRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                search: z.string().optional(),
                apenasAtivos: z.boolean().optional().default(true),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [];
            if (input?.apenasAtivos !== false) whereParts.push(eq(pacotes.status, 'ativo'));
            if (input?.search) whereParts.push(like(pacotes.nome, `%${input.search}%`));

            const query = ctx.db
                .select({
                    id: pacotes.id,
                    nome: pacotes.nome,
                    descricao: pacotes.descricao,
                    id_servico: pacotes.id_servico,
                    quantidade_sessoes: pacotes.quantidade_sessoes,
                    valor_total: pacotes.valor_total,
                    status: pacotes.status,
                    created_at: pacotes.created_at,
                    updated_at: pacotes.updated_at,
                    servico_nome: servicos.nome,
                })
                .from(pacotes)
                .leftJoin(servicos, eq(pacotes.id_servico, servicos.id))
                .orderBy(pacotes.nome);

            return whereParts.length ? query.where(and(...whereParts)) : query;
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({
                    id: pacotes.id,
                    nome: pacotes.nome,
                    descricao: pacotes.descricao,
                    id_servico: pacotes.id_servico,
                    quantidade_sessoes: pacotes.quantidade_sessoes,
                    valor_total: pacotes.valor_total,
                    status: pacotes.status,
                    servico_nome: servicos.nome,
                })
                .from(pacotes)
                .leftJoin(servicos, eq(pacotes.id_servico, servicos.id))
                .where(eq(pacotes.id, input.id))
                .limit(1);

            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pacote não encontrado' });
            return row;
        }),

    create: adminProcedure
        .input(
            z.object({
                nome: z.string().min(2),
                descricao: z.string().optional(),
                id_servico: z.number().int().positive().optional(),
                quantidade_sessoes: z.number().int().positive(),
                valor_total: z.number().min(0),
                status: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.id_servico) {
                const [srv] = await ctx.db.select({ id: servicos.id }).from(servicos)
                    .where(and(eq(servicos.id, input.id_servico), eq(servicos.ativo, true))).limit(1);
                if (!srv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
            }

            const ids = await ctx.db.insert(pacotes).values({
                nome: input.nome,
                descricao: input.descricao,
                id_servico: input.id_servico,
                quantidade_sessoes: input.quantidade_sessoes,
                valor_total: String(input.valor_total) as any,
                status: input.status ?? 'ativo',
            }).$returningId();

            return { id: ids[0]?.id };
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                nome: z.string().min(2).optional(),
                descricao: z.string().optional().nullable(),
                id_servico: z.number().int().positive().optional().nullable(),
                quantidade_sessoes: z.number().int().positive().optional(),
                valor_total: z.number().min(0).optional(),
                status: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db.select({ id: pacotes.id }).from(pacotes).where(eq(pacotes.id, input.id)).limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pacote não encontrado' });

            const set: Record<string, any> = { updated_at: new Date() };
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.descricao !== undefined) set.descricao = input.descricao;
            if (input.id_servico !== undefined) set.id_servico = input.id_servico;
            if (input.quantidade_sessoes !== undefined) set.quantidade_sessoes = input.quantidade_sessoes;
            if (input.valor_total !== undefined) set.valor_total = String(input.valor_total);
            if (input.status !== undefined) set.status = input.status;

            await ctx.db.update(pacotes).set(set).where(eq(pacotes.id, input.id));
            return { ok: true };
        }),
});
