import { TRPCError } from '@trpc/server';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import { servicoTecnica, servicos, tecnicas } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export const servicosRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                search: z.string().min(1).optional(),
                apenasAtivos: z.boolean().optional().default(true),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [];
            if (input?.apenasAtivos !== false) whereParts.push(eq(servicos.ativo, true));
            if (input?.search) whereParts.push(like(servicos.nome, `%${input.search}%`));

            const query = ctx.db
                .select({
                    servicoId: servicos.id,
                    nome: servicos.nome,
                    descricao: servicos.descricao,
                    imagem_url: servicos.imagem_url,
                    duracao_minutos: servicos.duracao_minutos,
                    valor: servicos.valor,
                    gera_credito: servicos.gera_credito,
                    ativo: servicos.ativo,
                    created_at: servicos.created_at,
                    updated_at: servicos.updated_at,
                    tecnicaId: tecnicas.id,
                    tecnicaNome: tecnicas.nome,
                })
                .from(servicos)
                .leftJoin(servicoTecnica, eq(servicoTecnica.servico_id, servicos.id))
                .leftJoin(tecnicas, eq(servicoTecnica.tecnica_id, tecnicas.id))
                .orderBy(servicos.nome);

            const rows = whereParts.length ? await query.where(and(...whereParts)) : await query;

            const map = new Map<number, any>();
            for (const r of rows) {
                if (!map.has(r.servicoId)) {
                    map.set(r.servicoId, {
                        id: r.servicoId,
                        nome: r.nome,
                        descricao: r.descricao,
                        imagem_url: r.imagem_url,
                        duracao_minutos: r.duracao_minutos,
                        valor: r.valor,
                        gera_credito: r.gera_credito,
                        ativo: r.ativo,
                        created_at: r.created_at,
                        updated_at: r.updated_at,
                        tecnicas: [] as Array<{ id: number; nome: string }>,
                    });
                }
                if (r.tecnicaId && r.tecnicaNome) {
                    map.get(r.servicoId)!.tecnicas.push({ id: r.tecnicaId, nome: r.tecnicaNome });
                }
            }
            return Array.from(map.values());
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const rows = await ctx.db
                .select({
                    servicoId: servicos.id,
                    nome: servicos.nome,
                    descricao: servicos.descricao,
                    imagem_url: servicos.imagem_url,
                    duracao_minutos: servicos.duracao_minutos,
                    valor: servicos.valor,
                    gera_credito: servicos.gera_credito,
                    ativo: servicos.ativo,
                    created_at: servicos.created_at,
                    updated_at: servicos.updated_at,
                    tecnicaId: tecnicas.id,
                    tecnicaNome: tecnicas.nome,
                })
                .from(servicos)
                .leftJoin(servicoTecnica, eq(servicoTecnica.servico_id, servicos.id))
                .leftJoin(tecnicas, eq(servicoTecnica.tecnica_id, tecnicas.id))
                .where(eq(servicos.id, input.id));

            if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });

            const base = rows[0];
            return {
                id: base.servicoId,
                nome: base.nome,
                descricao: base.descricao,
                imagem_url: base.imagem_url,
                duracao_minutos: base.duracao_minutos,
                valor: base.valor,
                gera_credito: base.gera_credito,
                ativo: base.ativo,
                created_at: base.created_at,
                updated_at: base.updated_at,
                tecnicas: rows
                    .filter((r) => r.tecnicaId && r.tecnicaNome)
                    .map((r) => ({ id: r.tecnicaId as number, nome: r.tecnicaNome as string })),
            };
        }),

    create: adminProcedure
        .input(
            z.object({
                nome: z.string().min(2),
                descricao: z.string().optional(),
                imagem_url: z.string().optional(),
                duracao_minutos: z.number().int().positive(),
                valor: z.number().positive(),
                gera_credito: z.boolean().optional(),
                ativo: z.boolean().optional(),
                tecnica_ids: z.array(z.number().int().positive()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const ids = await ctx.db
                .insert(servicos)
                .values({
                    nome: input.nome,
                    descricao: input.descricao,
                    imagem_url: input.imagem_url,
                    duracao_minutos: input.duracao_minutos,
                    valor: String(input.valor) as any,
                    gera_credito: input.gera_credito ?? true,
                    ativo: input.ativo ?? true,
                })
                .$returningId();
            const servicoId = ids[0]?.id;

            if (servicoId && input.tecnica_ids?.length) {
                await ctx.db.insert(servicoTecnica).values(
                    input.tecnica_ids.map((tid) => ({ servico_id: servicoId, tecnica_id: tid })),
                );
            }
            return { id: servicoId };
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                nome: z.string().min(2).optional(),
                descricao: z.string().optional().nullable(),
                imagem_url: z.string().optional().nullable(),
                duracao_minutos: z.number().int().positive().optional(),
                valor: z.number().positive().optional(),
                gera_credito: z.boolean().optional(),
                ativo: z.boolean().optional(),
                tecnica_ids: z.array(z.number().int().positive()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db.select({ id: servicos.id }).from(servicos).where(eq(servicos.id, input.id)).limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });

            const set: Record<string, any> = { updated_at: new Date() };
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.descricao !== undefined) set.descricao = input.descricao;
            if (input.imagem_url !== undefined) set.imagem_url = input.imagem_url;
            if (input.duracao_minutos !== undefined) set.duracao_minutos = input.duracao_minutos;
            if (input.valor !== undefined) set.valor = String(input.valor);
            if (input.gera_credito !== undefined) set.gera_credito = input.gera_credito;
            if (input.ativo !== undefined) set.ativo = input.ativo;

            await ctx.db.update(servicos).set(set).where(eq(servicos.id, input.id));

            if (input.tecnica_ids !== undefined) {
                await ctx.db.delete(servicoTecnica).where(eq(servicoTecnica.servico_id, input.id));
                if (input.tecnica_ids.length) {
                    await ctx.db.insert(servicoTecnica).values(
                        input.tecnica_ids.map((tid) => ({ servico_id: input.id, tecnica_id: tid })),
                    );
                }
            }
            return { ok: true };
        }),
});
