import { TRPCError } from '@trpc/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { pacotes, protocolos, servicos } from '../../drizzle/schema';
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
    /** Serviços que aparecem nesta página, na ordem. Omitido: não mexe nos serviços. */
    servico_ids: z.array(z.number().int().positive()).optional(),
});

const SEP = ' – ';

/** Troca o nome nas vendas (e o dos pacotes) só quando ele foi gerado pelo sistema. */
async function renomear(db: any, s: { id: number; nome: string }, novo: string) {
    if (novo === s.nome) return;
    await db.update(servicos).set({ nome: novo, updated_at: new Date() }).where(eq(servicos.id, s.id));
    const ps = await db.select({ id: pacotes.id, nome: pacotes.nome }).from(pacotes).where(eq(pacotes.id_servico, s.id));
    for (const p of ps) {
        if (p.nome.startsWith(`${s.nome}${SEP}`)) {
            await db.update(pacotes).set({ nome: novo + p.nome.slice(s.nome.length) }).where(eq(pacotes.id, p.id));
        }
    }
}

/**
 * Liga à página os serviços escolhidos nela (na ordem) e desliga os que saíram.
 * Faz o mesmo que marcar/desmarcar "Exibir no site" no formulário do serviço.
 */
async function ligarServicos(db: any, idProtocolo: number, ids: number[], nomeAntigo?: string) {
    const [pagina] = await db.select({ nome: protocolos.nome }).from(protocolos).where(eq(protocolos.id, idProtocolo)).limit(1);
    if (!pagina) return;
    const todos: { id: number; nome: string; nome_modalidade: string | null; id_protocolo: number | null }[] = await db
        .select({ id: servicos.id, nome: servicos.nome, nome_modalidade: servicos.nome_modalidade, id_protocolo: servicos.id_protocolo })
        .from(servicos);
    const nomesPaginas = new Map<number, string>(
        (await db.select({ id: protocolos.id, nome: protocolos.nome }).from(protocolos)).map((p: any) => [p.id, p.nome]),
    );
    // Página renomeada agora: os nomes gerados ainda usam o nome antigo
    if (nomeAntigo) nomesPaginas.set(idProtocolo, nomeAntigo);
    const escolhidos = new Set(ids);

    for (const s of todos) {
        if (s.id_protocolo !== idProtocolo || escolhidos.has(s.id)) continue;
        const curto = s.nome_modalidade || s.nome;
        await db.update(servicos).set({ id_protocolo: null, nome_modalidade: null, regioes: '[]', ordem_modalidade: 0 }).where(eq(servicos.id, s.id));
        if (s.nome === `${nomesPaginas.get(idProtocolo)}${SEP}${curto}`) await renomear(db, s, curto);
    }

    for (const [ordem, id] of ids.entries()) {
        const s = todos.find((x) => x.id === id);
        if (!s) continue;
        const curto = s.nome_modalidade || s.nome;
        const anterior = s.id_protocolo ? nomesPaginas.get(s.id_protocolo) : undefined;
        const gerado = anterior ? s.nome === `${anterior}${SEP}${curto}` : s.nome === curto;
        await db.update(servicos).set({ id_protocolo: idProtocolo, nome_modalidade: curto, ordem_modalidade: ordem }).where(eq(servicos.id, id));
        if (gerado) await renomear(db, s, `${pagina.nome}${SEP}${curto}`);
    }
}

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
        const { servico_ids, ...dados } = input;
        const slug = slugify(dados.slug || dados.nome);
        await garantirSlugLivre(ctx.db, slug);
        return ctx.db.transaction(async (tx) => {
            const ids = await tx
                .insert(protocolos)
                .values({ ...(paraBanco(dados) as any), nome: dados.nome, slug })
                .$returningId();
            const id = ids[0]?.id;
            if (id && servico_ids) await ligarServicos(tx, id, servico_ids);
            return { id };
        });
    }),

    update: adminProcedure
        .input(protocoloInput.partial().extend({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const { id, servico_ids, ...dados } = input;
            const set = paraBanco(dados);
            if (typeof set.slug === 'string') await garantirSlugLivre(ctx.db, set.slug, id);
            const [antes] = await ctx.db.select({ nome: protocolos.nome }).from(protocolos).where(eq(protocolos.id, id)).limit(1);
            await ctx.db.transaction(async (tx) => {
                await tx.update(protocolos).set({ ...(set as any), updated_at: new Date() }).where(eq(protocolos.id, id));
                if (servico_ids) await ligarServicos(tx, id, servico_ids, antes?.nome);
            });
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
