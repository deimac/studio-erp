import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { servicos, servicoTecnica, tecnicas, pacotes, protocolos } from '../../drizzle/schema';
import { menorPreco, parseLista } from '../../lib/protocolos';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { lerSiteConfig } from './siteConfig';

/** Modalidades (serviços ativos) de um conjunto de protocolos, com pacotes ativos. */
async function carregarModalidades(db: any, protocoloIds: number[]) {
    if (!protocoloIds.length) return [];
    const rows = await db
        .select({
            id: servicos.id,
            id_protocolo: servicos.id_protocolo,
            nome: servicos.nome,
            nome_modalidade: servicos.nome_modalidade,
            duracao_minutos: servicos.duracao_minutos,
            valor: servicos.valor,
            regioes: servicos.regioes,
        })
        .from(servicos)
        .where(and(eq(servicos.ativo, true), isNotNull(servicos.id_protocolo), inArray(servicos.id_protocolo, protocoloIds)))
        .orderBy(asc(servicos.ordem_modalidade), asc(servicos.duracao_minutos), asc(servicos.nome));

    const ids = rows.map((r: any) => r.id);
    const pacoteRows = ids.length
        ? await db
              .select({
                  id: pacotes.id,
                  id_servico: pacotes.id_servico,
                  nome: pacotes.nome,
                  quantidade_sessoes: pacotes.quantidade_sessoes,
                  valor_total: pacotes.valor_total,
              })
              .from(pacotes)
              .where(and(eq(pacotes.status, 'ativo'), inArray(pacotes.id_servico, ids)))
              .orderBy(asc(pacotes.quantidade_sessoes))
        : [];

    return rows.map((r: any) => ({
        ...r,
        regioes: parseLista(r.regioes),
        pacotes: pacoteRows
            .filter((p: any) => p.id_servico === r.id)
            .map(({ id_servico, ...p }: any) => p),
    }));
}

export const publicCatalogoRouter = createTRPCRouter({
    /** Resumo dos protocolos ativos para a home. */
    listProtocolos: publicProcedure.query(async ({ ctx }) => {
        const lista = await ctx.db
            .select()
            .from(protocolos)
            .where(eq(protocolos.ativo, true))
            .orderBy(asc(protocolos.ordem), asc(protocolos.nome));
        const modalidades = await carregarModalidades(ctx.db, lista.map((p) => p.id));
        return lista.map((p) => {
            const doProtocolo = modalidades.filter((m: any) => m.id_protocolo === p.id);
            return {
                id: p.id,
                nome: p.nome,
                slug: p.slug,
                subtitulo: p.subtitulo,
                icone: p.icone,
                imagem_url: p.imagem_url,
                permite_vale_presente: p.permite_vale_presente,
                a_partir_de: menorPreco(doProtocolo),
                duracoes: [...new Set<number>(doProtocolo.map((m: any) => m.duracao_minutos))].sort((a, b) => a - b),
            };
        });
    }),

    /** Protocolo completo com modalidades e pacotes; null se não existir/inativo. */
    getProtocoloBySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ ctx, input }) => {
        const [p] = await ctx.db
            .select()
            .from(protocolos)
            .where(and(eq(protocolos.slug, input.slug), eq(protocolos.ativo, true)))
            .limit(1);
        if (!p) return null;
        const modalidades = await carregarModalidades(ctx.db, [p.id]);
        return {
            ...p,
            inclui: parseLista(p.inclui),
            beneficios: parseLista(p.beneficios),
            modalidades: modalidades.map(({ id_protocolo, ...m }: any) => m),
        };
    }),

    getSiteConfig: publicProcedure.query(({ ctx }) => lerSiteConfig(ctx.db)),

    /**
     * Lista serviços ativos com seus pacotes ativos vinculados.
     * Endpoint público (sem autenticação) — usado pela landing page.
     * Retorna apenas campos públicos (sem dados sensíveis).
     */
    listServicosComPacotes: publicProcedure.query(async ({ ctx }) => {
        // 1) Buscar serviços ativos + técnicas
        const servicoRows = await ctx.db
            .select({
                servicoId: servicos.id,
                nome: servicos.nome,
                descricao: servicos.descricao,
                imagem_url: servicos.imagem_url,
                duracao_minutos: servicos.duracao_minutos,
                valor: servicos.valor,
                tecnicaId: tecnicas.id,
                tecnicaNome: tecnicas.nome,
            })
            .from(servicos)
            .leftJoin(servicoTecnica, eq(servicoTecnica.servico_id, servicos.id))
            .leftJoin(tecnicas, eq(servicoTecnica.tecnica_id, tecnicas.id))
            // Só serviços publicados (com protocolo); serviços internos e de profissionais ficam fora
            .where(and(eq(servicos.ativo, true), isNotNull(servicos.id_protocolo)))
            .orderBy(servicos.nome);

        // 2) Agrupar técnicas por serviço
        const servicoMap = new Map<
            number,
            {
                id: number;
                nome: string;
                descricao: string | null;
                imagem_url: string | null;
                duracao_minutos: number;
                valor: string;
                tecnicas: Array<{ id: number; nome: string }>;
                pacotes: Array<{
                    id: number;
                    nome: string;
                    descricao: string | null;
                    quantidade_sessoes: number;
                    valor_total: string;
                }>;
            }
        >();

        for (const r of servicoRows) {
            if (!servicoMap.has(r.servicoId)) {
                servicoMap.set(r.servicoId, {
                    id: r.servicoId,
                    nome: r.nome,
                    descricao: r.descricao,
                    imagem_url: r.imagem_url,
                    duracao_minutos: r.duracao_minutos,
                    valor: r.valor,
                    tecnicas: [],
                    pacotes: [],
                });
            }
            if (r.tecnicaId && r.tecnicaNome) {
                const svc = servicoMap.get(r.servicoId)!;
                // Evitar duplicatas (join pode gerar múltiplas linhas)
                if (!svc.tecnicas.some((t) => t.id === r.tecnicaId)) {
                    svc.tecnicas.push({ id: r.tecnicaId, nome: r.tecnicaNome });
                }
            }
        }

        // 3) Buscar pacotes ativos
        const pacoteRows = await ctx.db
            .select({
                id: pacotes.id,
                nome: pacotes.nome,
                descricao: pacotes.descricao,
                id_servico: pacotes.id_servico,
                quantidade_sessoes: pacotes.quantidade_sessoes,
                valor_total: pacotes.valor_total,
            })
            .from(pacotes)
            .where(eq(pacotes.status, 'ativo'))
            .orderBy(pacotes.quantidade_sessoes);

        // 4) Vincular pacotes aos serviços
        for (const p of pacoteRows) {
            if (p.id_servico && servicoMap.has(p.id_servico)) {
                servicoMap.get(p.id_servico)!.pacotes.push({
                    id: p.id,
                    nome: p.nome,
                    descricao: p.descricao,
                    quantidade_sessoes: p.quantidade_sessoes,
                    valor_total: p.valor_total,
                });
            }
        }

        return Array.from(servicoMap.values());
    }),
});
