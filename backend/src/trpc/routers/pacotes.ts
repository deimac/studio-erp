import { TRPCError } from '@trpc/server';
import { and, eq, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { pacotes, servicos } from '../../drizzle/schema';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { podeEditarServico } from '../../lib/servicosAcesso';
import { vendas } from '../../drizzle/schema';

/** Status do pacote sempre em minúsculas ('ativo' | 'inativo'), como o site filtra. */
const zStatus = z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.enum(['ativo', 'inativo']));

/** O usuário pode mexer nos pacotes deste serviço? (dono do serviço ou admin) */
async function assertServicoEditavel(ctx: any, idServico: number | null | undefined) {
    if (!idServico) {
        if (ctx.session.perfil !== 'ADMIN') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe o serviço do pacote' });
        return;
    }
    const [srv] = await ctx.db.select({ id: servicos.id, dono: servicos.id_profissional }).from(servicos).where(eq(servicos.id, idServico)).limit(1);
    if (!srv || !podeEditarServico(srv.dono, ctx.session)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
}

async function pacoteEditavel(ctx: any, id: number) {
    const [row] = await ctx.db.select({ id: pacotes.id, id_servico: pacotes.id_servico }).from(pacotes).where(eq(pacotes.id, id)).limit(1);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pacote não encontrado' });
    await assertServicoEditavel(ctx, row.id_servico);
    return row;
}
import { servicosVisiveis } from '../acesso';

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
            // Profissional vê só pacotes de serviços que ele enxerga
            const visiveis = servicosVisiveis(ctx.session);
            if (visiveis) whereParts.push(visiveis);

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

    /** Dono do serviço (profissional) ou admin. */
    create: protectedProcedure
        .input(
            z.object({
                nome: z.string().min(2),
                descricao: z.string().optional(),
                id_servico: z.number().int().positive().optional(),
                quantidade_sessoes: z.number().int().positive(),
                valor_total: z.number().min(0),
                status: zStatus.optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await assertServicoEditavel(ctx, input.id_servico);

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

    update: protectedProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                nome: z.string().min(2).optional(),
                descricao: z.string().optional().nullable(),
                id_servico: z.number().int().positive().optional().nullable(),
                quantidade_sessoes: z.number().int().positive().optional(),
                valor_total: z.number().min(0).optional(),
                status: zStatus.optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await pacoteEditavel(ctx, input.id);
            if (input.id_servico) await assertServicoEditavel(ctx, input.id_servico);

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

    delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await pacoteEditavel(ctx, input.id);
            const [venda] = await ctx.db.select({ id: vendas.id }).from(vendas).where(eq(vendas.id_pacote, input.id)).limit(1);
            if (venda)
                throw new TRPCError({ code: 'CONFLICT', message: 'Este pacote já foi vendido: desative em vez de excluir' });

            await ctx.db.delete(pacotes).where(eq(pacotes.id, input.id));
            return { ok: true };
        }),
});
