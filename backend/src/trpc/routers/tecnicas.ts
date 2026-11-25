import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { servicoTecnica, tecnicas } from '../../drizzle/schema';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { tecnicasVisiveis } from '../acesso';
import { podeEditarServico } from '../../lib/servicosAcesso';

/** Admin cria técnicas da clínica; profissional cria as próprias. */
async function tecnicaEditavel(ctx: any, id: number) {
    const [t] = await ctx.db.select({ id: tecnicas.id, dono: tecnicas.id_profissional }).from(tecnicas).where(eq(tecnicas.id, id)).limit(1);
    if (!t || !podeEditarServico(t.dono, ctx.session)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Técnica não encontrada' });
    return t as { id: number; dono: number | null };
}

const tipoInput = z.enum(['TECNICA', 'BENEFICIO']);

async function assertNomeLivre(ctx: any, nome: string, dono: number | null, ignorarId?: number) {
    const [e] = await ctx.db
        .select({ id: tecnicas.id })
        .from(tecnicas)
        .where(and(eq(tecnicas.nome, nome), dono == null ? isNull(tecnicas.id_profissional) : eq(tecnicas.id_profissional, dono)))
        .limit(1);
    if (e && e.id !== ignorarId) throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um item com esse nome' });
}

export const tecnicasRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
        return ctx.db.select().from(tecnicas).where(tecnicasVisiveis(ctx.session)).orderBy(asc(tecnicas.nome));
    }),

    create: protectedProcedure
        .input(z.object({ nome: z.string().trim().min(2), tipo: tipoInput.default('TECNICA') }))
        .mutation(async ({ ctx, input }) => {
            const dono = ctx.session.perfil === 'ADMIN' ? null : ctx.session.id;
            await assertNomeLivre(ctx, input.nome, dono);
            const ids = await ctx.db.insert(tecnicas).values({ nome: input.nome, tipo: input.tipo, id_profissional: dono }).$returningId();
            return { id: ids[0]?.id };
        }),

    update: protectedProcedure
        .input(z.object({ id: z.number().int().positive(), nome: z.string().trim().min(2), tipo: tipoInput.optional() }))
        .mutation(async ({ ctx, input }) => {
            const t = await tecnicaEditavel(ctx, input.id);
            await assertNomeLivre(ctx, input.nome, t.dono, t.id);
            await ctx.db.update(tecnicas).set({ nome: input.nome, ...(input.tipo ? { tipo: input.tipo } : {}) }).where(eq(tecnicas.id, input.id));
            return { ok: true };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await tecnicaEditavel(ctx, input.id);
            // Só exclui técnica sem vínculo com serviço (ativo ou inativo)
            const [uso] = await ctx.db
                .select({ cnt: count() })
                .from(servicoTecnica)
                .where(eq(servicoTecnica.tecnica_id, input.id));
            const n = Number(uso?.cnt ?? 0);
            if (n > 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: `Não é possível excluir: o item está em ${n === 1 ? '1 serviço' : `${n} serviços`}. Remova dos serviços antes.`,
                });
            }
            await ctx.db.delete(tecnicas).where(eq(tecnicas.id, input.id));
            return { ok: true };
        }),
});
