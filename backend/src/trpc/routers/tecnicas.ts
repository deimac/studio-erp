import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { tecnicas } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export const tecnicasRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.select().from(tecnicas).orderBy(asc(tecnicas.nome));
    }),

    create: adminProcedure
        .input(z.object({ nome: z.string().min(2) }))
        .mutation(async ({ ctx, input }) => {
            const ids = await ctx.db.insert(tecnicas).values({ nome: input.nome }).$returningId();
            return { id: ids[0]?.id };
        }),

    update: adminProcedure
        .input(z.object({ id: z.number().int().positive(), nome: z.string().min(2) }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.update(tecnicas).set({ nome: input.nome }).where(eq(tecnicas.id, input.id));
            return { ok: true };
        }),

    delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(tecnicas).where(eq(tecnicas.id, input.id));
            return { ok: true };
        }),
});
