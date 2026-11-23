import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { asc, count, eq } from 'drizzle-orm';
import { servicoTecnica, tecnicas } from '../../drizzle/schema';
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
            // Só exclui técnica sem vínculo com serviço (ativo ou inativo)
            const [uso] = await ctx.db
                .select({ cnt: count() })
                .from(servicoTecnica)
                .where(eq(servicoTecnica.tecnica_id, input.id));
            const n = Number(uso?.cnt ?? 0);
            if (n > 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `Não é possível excluir: a técnica está em ${n === 1 ? '1 serviço' : `${n} serviços`}. Remova dos serviços antes.`,
                });
            }
            await ctx.db.delete(tecnicas).where(eq(tecnicas.id, input.id));
            return { ok: true };
        }),
});
