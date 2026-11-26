import { TRPCError } from '@trpc/server';
import { and, eq, isNull, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { profissionalServicos, servicoTecnica, servicos, tecnicas, usuarios } from '../../drizzle/schema';
import { parseLista } from '../../lib/protocolos';
import { podeEditarServico, podeVerServico } from '../../lib/servicosAcesso';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { assertPodeCadastrar, quemAtendeServicos, servicosVisiveis, tecnicasVisiveis, type DbOuTx } from '../acesso';
import { inArray } from 'drizzle-orm';

/** Campos do site (protocolo/modalidade): só o admin define. */
const CAMPOS_SITE = ['id_protocolo', 'nome_modalidade', 'regioes', 'ordem_modalidade'] as const;


/** Profissional só marca técnicas que enxerga (próprias ou da clínica, se liberado). */
async function assertTecnicasVisiveis(ctx: any, ids: number[] | undefined) {
    if (!ids?.length) return;
    const cond = tecnicasVisiveis(ctx.session);
    if (!cond) return;
    const ok = await ctx.db.select({ id: tecnicas.id }).from(tecnicas).where(and(inArray(tecnicas.id, ids), cond));
    if (ok.length !== new Set(ids).size) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Técnica não disponível para você' });
}

/** Grava quem atende o serviço da clínica (vazio = todos). */
async function salvarQuemAtende(db: DbOuTx, idServico: number, ids: number[]) {
    await db.delete(profissionalServicos).where(eq(profissionalServicos.id_servico, idServico));
    const unicos = [...new Set(ids)];
    if (unicos.length) await db.insert(profissionalServicos).values(unicos.map((id_profissional) => ({ id_profissional, id_servico: idServico })));
}

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
            // Profissional vê os próprios (e os da clínica, se o admin liberou); nunca os de colegas
            const visiveis = servicosVisiveis(ctx.session);
            if (visiveis) whereParts.push(visiveis);

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
                    id_protocolo: servicos.id_protocolo,
                    nome_modalidade: servicos.nome_modalidade,
                    regioes: servicos.regioes,
                    ordem_modalidade: servicos.ordem_modalidade,
                    id_profissional: servicos.id_profissional,
                    profissional_nome: usuarios.nome,
                    created_at: servicos.created_at,
                    updated_at: servicos.updated_at,
                    tecnicaId: tecnicas.id,
                    tecnicaNome: tecnicas.nome,
                    tecnicaTipo: tecnicas.tipo,
                })
                .from(servicos)
                .leftJoin(usuarios, eq(usuarios.id, servicos.id_profissional))
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
                        id_protocolo: r.id_protocolo,
                        nome_modalidade: r.nome_modalidade,
                        regioes: parseLista(r.regioes),
                        ordem_modalidade: r.ordem_modalidade,
                        id_profissional: r.id_profissional,
                        profissional_nome: r.profissional_nome,
                        created_at: r.created_at,
                        updated_at: r.updated_at,
                        tecnicas: [] as Array<{ id: number; nome: string; tipo: string }>,
                    });
                }
                if (r.tecnicaId && r.tecnicaNome) {
                    map.get(r.servicoId)!.tecnicas.push({ id: r.tecnicaId, nome: r.tecnicaNome, tipo: r.tecnicaTipo ?? 'TECNICA' });
                }
            }
            const quem = await quemAtendeServicos(ctx.db, [...map.keys()]);
            for (const [id, sv] of map) sv.profissional_ids = quem.get(id) ?? [];
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
                    id_protocolo: servicos.id_protocolo,
                    nome_modalidade: servicos.nome_modalidade,
                    regioes: servicos.regioes,
                    ordem_modalidade: servicos.ordem_modalidade,
                    id_profissional: servicos.id_profissional,
                    profissional_nome: usuarios.nome,
                    created_at: servicos.created_at,
                    updated_at: servicos.updated_at,
                    tecnicaId: tecnicas.id,
                    tecnicaNome: tecnicas.nome,
                    tecnicaTipo: tecnicas.tipo,
                })
                .from(servicos)
                .leftJoin(usuarios, eq(usuarios.id, servicos.id_profissional))
                .leftJoin(servicoTecnica, eq(servicoTecnica.servico_id, servicos.id))
                .leftJoin(tecnicas, eq(servicoTecnica.tecnica_id, tecnicas.id))
                .where(eq(servicos.id, input.id));

            if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });

            const base = rows[0];
            if (!podeVerServico(base.id_profissional, ctx.session))
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
            return {
                id: base.servicoId,
                nome: base.nome,
                descricao: base.descricao,
                imagem_url: base.imagem_url,
                duracao_minutos: base.duracao_minutos,
                valor: base.valor,
                gera_credito: base.gera_credito,
                ativo: base.ativo,
                id_protocolo: base.id_protocolo,
                nome_modalidade: base.nome_modalidade,
                regioes: parseLista(base.regioes),
                ordem_modalidade: base.ordem_modalidade,
                id_profissional: base.id_profissional,
                profissional_nome: base.profissional_nome,
                created_at: base.created_at,
                updated_at: base.updated_at,
                tecnicas: rows
                    .filter((r) => r.tecnicaId && r.tecnicaNome)
                    .map((r) => ({ id: r.tecnicaId as number, nome: r.tecnicaNome as string, tipo: (r.tecnicaTipo as string) ?? 'TECNICA' })),
                profissional_ids: (await quemAtendeServicos(ctx.db, [base.servicoId])).get(base.servicoId) ?? [],
            };
        }),

    create: protectedProcedure
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
                id_protocolo: z.number().int().positive().nullable().optional(),
                nome_modalidade: z.string().nullable().optional(),
                regioes: z.array(z.string()).optional(),
                ordem_modalidade: z.number().int().optional(),
                profissional_ids: z.array(z.number().int().positive()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            assertPodeCadastrar(ctx.session);
            const admin = ctx.session.perfil === 'ADMIN';
            // Profissional cadastra só serviços próprios, sem protocolo (fora do site)
            if (!admin) for (const c of CAMPOS_SITE) delete (input as any)[c];
            await assertTecnicasVisiveis(ctx, input.tecnica_ids);
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
                    id_protocolo: input.id_protocolo ?? null,
                    nome_modalidade: input.nome_modalidade ?? null,
                    regioes: input.regioes ? JSON.stringify(input.regioes) : null,
                    ordem_modalidade: input.ordem_modalidade ?? 0,
                    id_profissional: admin ? null : ctx.session.id,
                })
                .$returningId();
            const servicoId = ids[0]?.id;

            if (servicoId && input.tecnica_ids?.length) {
                await ctx.db.insert(servicoTecnica).values(
                    input.tecnica_ids.map((tid) => ({ servico_id: servicoId, tecnica_id: tid })),
                );
            }
            if (servicoId && admin && input.profissional_ids?.length) await salvarQuemAtende(ctx.db, servicoId, input.profissional_ids);
            return { id: servicoId };
        }),

    update: protectedProcedure
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
                id_protocolo: z.number().int().positive().nullable().optional(),
                nome_modalidade: z.string().nullable().optional(),
                regioes: z.array(z.string()).optional(),
                ordem_modalidade: z.number().int().optional(),
                profissional_ids: z.array(z.number().int().positive()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: servicos.id, dono: servicos.id_profissional })
                .from(servicos)
                .where(eq(servicos.id, input.id))
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
            if (!podeEditarServico(row.dono, ctx.session))
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Você só pode editar os seus próprios serviços' });
            if (ctx.session.perfil !== 'ADMIN') for (const c of CAMPOS_SITE) delete (input as any)[c];
            await assertTecnicasVisiveis(ctx, input.tecnica_ids);

            const set: Record<string, any> = { updated_at: new Date() };
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.descricao !== undefined) set.descricao = input.descricao;
            if (input.imagem_url !== undefined) set.imagem_url = input.imagem_url;
            if (input.duracao_minutos !== undefined) set.duracao_minutos = input.duracao_minutos;
            if (input.valor !== undefined) set.valor = String(input.valor);
            if (input.gera_credito !== undefined) set.gera_credito = input.gera_credito;
            if (input.ativo !== undefined) set.ativo = input.ativo;
            if (input.id_protocolo !== undefined) set.id_protocolo = input.id_protocolo;
            if (input.nome_modalidade !== undefined) set.nome_modalidade = input.nome_modalidade;
            if (input.regioes !== undefined) set.regioes = JSON.stringify(input.regioes);
            if (input.ordem_modalidade !== undefined) set.ordem_modalidade = input.ordem_modalidade;

            await ctx.db.update(servicos).set(set).where(eq(servicos.id, input.id));

            if (input.tecnica_ids !== undefined) {
                await ctx.db.delete(servicoTecnica).where(eq(servicoTecnica.servico_id, input.id));
                if (input.tecnica_ids.length) {
                    await ctx.db.insert(servicoTecnica).values(
                        input.tecnica_ids.map((tid) => ({ servico_id: input.id, tecnica_id: tid })),
                    );
                }
            }
            if (input.profissional_ids !== undefined && ctx.session.perfil === 'ADMIN' && row.dono == null)
                await salvarQuemAtende(ctx.db, input.id, input.profissional_ids);
            return { ok: true };
        }),
});
