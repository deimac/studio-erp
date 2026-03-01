import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { unidades } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter } from '../trpc';

export const unidadesRouter = createTRPCRouter({
    list: adminProcedure.query(async ({ ctx }) => {
        return ctx.db.select().from(unidades).orderBy(unidades.nome);
    }),

    create: adminProcedure
        .input(z.object({ nome: z.string().min(2) }))
        .mutation(async ({ ctx, input }) => {
            const ids = await ctx.db.insert(unidades).values({ nome: input.nome, ativo: true }).$returningId();
            return { id: ids[0]?.id };
        }),

    update: adminProcedure
        .input(z.object({
            id: z.number().int().positive(),
            nome: z.string().min(2).optional(),
            ativo: z.boolean().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const set: Record<string, any> = { updated_at: new Date() };
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.ativo !== undefined) set.ativo = input.ativo;
            await ctx.db.update(unidades).set(set).where(eq(unidades.id, input.id));
            return { ok: true };
        }),
});
