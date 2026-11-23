import { TRPCError } from '@trpc/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { protocolos, servicos } from '../../drizzle/schema';
import { parseLista, slugify } from '../../lib/protocolos';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

const protocoloInput = z.object({
    nome: z.string().min(2),
    slug: z.string().optional(),
    subtitulo: z.string().nullable().optional(),
    descricao: z.string().nullable().optional(),
    inclui: z.array(z.string()).optional(),
    beneficios: z.array(z.string()).optional(),
    aviso: z.string().nullable().optional(),
    frase_final: z.string().nullable().optional(),
    icone: z.string().nullable().optional(),
    imagem_url: z.string().nullable().optional(),
    ordem: z.number().int().optional(),
    permite_vale_presente: z.boolean().optional(),
    ativo: z.boolean().optional(),
});

type ProtocoloRow = typeof protocolos.$inferSelect;

export function serializarProtocolo(p: ProtocoloRow) {
    return { ...p, inclui: parseLista(p.inclui), beneficios: parseLista(p.beneficios) };
}

function paraBanco(input: Partial<z.infer<typeof protocoloInput>>) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        if (v === undefined) continue;
        set[k] = k === 'inclui' || k === 'beneficios' ? JSON.stringify(v) : v;
    }
    if (typeof input.slug === 'string') set.slug = slugify(input.slug);
    return set;
}

async function garantirSlugLivre(db: any, slug: string, ignorarId?: number) {
    const [existente] = await db.select({ id: protocolos.id }).from(protocolos).where(eq(protocolos.slug, slug)).limit(1);
    if (existente && existente.id !== ignorarId) {
        throw new TRPCError({ code: 'CONFLICT', message: `Já existe um protocolo com o endereço "${slug}"` });
    }
}

export const protocolosRouter = createTRPCRouter({
    list: protectedProcedure.query(async ({ ctx }) => {
        // Protocolos agrupam serviços da clínica: profissional sem acesso a eles não vê
        if (ctx.session.perfil !== 'ADMIN' && !ctx.session.veServicosClinica) return [];
        const rows = await ctx.db.select().from(protocolos).orderBy(asc(protocolos.ordem), asc(protocolos.nome));
        const vinculados = await ctx.db
            .select({ id: servicos.id, nome: servicos.nome, nome_modalidade: servicos.nome_modalidade, id_protocolo: servicos.id_protocolo })
            .from(servicos)
            .orderBy(asc(servicos.ordem_modalidade), asc(servicos.nome));
        return rows.map((p) => ({
            ...serializarProtocolo(p),
            servicos: vinculados
                .filter((s) => s.id_protocolo === p.id)
                .map(({ id, nome, nome_modalidade }) => ({ id, nome, nome_modalidade })),
        }));
    }),

    getById: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const [p] = await ctx.db.select().from(protocolos).where(eq(protocolos.id, input.id)).limit(1);
        if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Protocolo não encontrado' });
        return serializarProtocolo(p);
    }),

    create: adminProcedure.input(protocoloInput).mutation(async ({ ctx, input }) => {
        const slug = slugify(input.slug || input.nome);
        await garantirSlugLivre(ctx.db, slug);
        const ids = await ctx.db
            .insert(protocolos)
            .values({ ...(paraBanco(input) as any), nome: input.nome, slug })
            .$returningId();
        return { id: ids[0]?.id };
    }),

    update: adminProcedure
        .input(protocoloInput.partial().extend({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const { id, ...dados } = input;
            const set = paraBanco(dados);
            if (typeof set.slug === 'string') await garantirSlugLivre(ctx.db, set.slug, id);
            await ctx.db.update(protocolos).set({ ...(set as any), updated_at: new Date() }).where(eq(protocolos.id, id));
            return { ok: true };
        }),

    delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await ctx.db.delete(protocolos).where(eq(protocolos.id, input.id));
        return { ok: true };
    }),

    reorder: adminProcedure.input(z.object({ ids: z.array(z.number().int().positive()) })).mutation(async ({ ctx, input }) => {
        if (!input.ids.length) return { ok: true };
        const existentes = await ctx.db.select({ id: protocolos.id }).from(protocolos).where(inArray(protocolos.id, input.ids));
        const validos = new Set(existentes.map((e) => e.id));
        for (const [ordem, id] of input.ids.entries()) {
            if (validos.has(id)) await ctx.db.update(protocolos).set({ ordem }).where(eq(protocolos.id, id));
        }
        return { ok: true };
    }),
});
