import { eq, and } from 'drizzle-orm';
import { servicos, servicoTecnica, tecnicas, pacotes } from '../../drizzle/schema';
import { createTRPCRouter, publicProcedure } from '../trpc';

export const publicCatalogoRouter = createTRPCRouter({
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
            .where(eq(servicos.ativo, true))
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
