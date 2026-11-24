import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { unidades } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter } from '../trpc';

const zModo = z.enum(['CLINICA', 'INDIVIDUAL']);

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

    /** Como a unidade do admin trabalha: Clínica (admin vê todos) ou cada um cuida do seu. */
    modoTrabalho: adminProcedure.query(async ({ ctx }) => {
        const [u] = await ctx.db.select({ modo: unidades.modo_trabalho }).from(unidades).where(eq(unidades.id, ctx.session.unidadeId)).limit(1);
        return (u?.modo ?? 'CLINICA') as z.infer<typeof zModo>;
    }),

    salvarModoTrabalho: adminProcedure.input(z.object({ modo: zModo })).mutation(async ({ ctx, input }) => {
        await ctx.db
            .update(unidades)
            .set({ modo_trabalho: input.modo, updated_at: new Date() })
            .where(eq(unidades.id, ctx.session.unidadeId));
        return { ok: true };
    }),
});
