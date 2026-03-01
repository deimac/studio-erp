import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { formasPagamento } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export const formasPagamentoRouter = createTRPCRouter({
    list: protectedProcedure
        .input(z.object({ apenasAtivos: z.boolean().optional().default(true) }).optional())
        .query(async ({ ctx, input }) => {
            if (input?.apenasAtivos !== false) {
                return ctx.db.select().from(formasPagamento).where(eq(formasPagamento.ativo, true)).orderBy(formasPagamento.nome);
            }
            return ctx.db.select().from(formasPagamento).orderBy(formasPagamento.nome);
        }),

    create: adminProcedure
        .input(z.object({ nome: z.string().min(2), descricao: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const ids = await ctx.db.insert(formasPagamento).values({
                nome: input.nome,
                descricao: input.descricao,
                ativo: true,
            }).$returningId();
            return { id: ids[0]?.id };
        }),

    update: adminProcedure
        .input(z.object({
            id: z.number().int().positive(),
            nome: z.string().min(2).optional(),
            descricao: z.string().optional().nullable(),
            ativo: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const set: Record<string, any> = { updated_at: new Date() };
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.descricao !== undefined) set.descricao = input.descricao;
            if (input.ativo !== undefined) set.ativo = input.ativo;

            await ctx.db.update(formasPagamento).set(set).where(eq(formasPagamento.id, input.id));
            return { ok: true };
        }),
});
