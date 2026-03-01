import { TRPCError } from '@trpc/server';
import { and, eq, isNull, isNotNull, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import {
    vendas,
    pessoas,
    servicos,
    pacotes,
    financeiro,
    formasPagamento,
    atendimentos,
} from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

/* ── helpers ─────────────────────────────────────────────── */

function normalizeDateOnly(value: string) {
    const datePart = value.includes('T') ? value.split('T')[0] : value;
    const d = new Date(`${datePart}T00:00:00`);
    if (isNaN(d.getTime())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data inválida' });
    return d;
}

function toDateStr(d: Date) {
    return d.toISOString().split('T')[0];
}

/* ── router ──────────────────────────────────────────────── */

export const vendasRouter = createTRPCRouter({
    /** Verifica se existe venda vinculada a pessoa */
    hasVinculoPessoa: protectedProcedure
        .input(z.object({ id_pessoa: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id_pessoa, input.id_pessoa),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            return Boolean(row);
        }),
    /* ============= Atualizar valor da parcela principal ============= */
    atualizarValorParcelaPrincipal: adminProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            // Buscar todas as parcelas principal+filhas
            const parcelas = await ctx.db.select({ id: financeiro.id, valor: financeiro.valor })
                .from(financeiro)
                .where(
                    and(
                        eq(financeiro.id_venda, input.id_venda),
                        eq(financeiro.parcela, input.parcela)
                    )
                );
            // Soma dos valores
            const valorTotal = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);
            // Atualiza valor da principal
            await ctx.db.update(financeiro)
                .set({ valor: String(valorTotal) })
                .where(eq(financeiro.id, input.id_financeiro));
            return { ok: true, valorRestaurado: valorTotal };
        }),
    /* ============= Restaurar parcela original ============= */
    restaurarParcelaOriginal: adminProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            // Buscar todas as parcelas principal+filhas
            const parcelas = await ctx.db.select({ id: financeiro.id, valor: financeiro.valor })
                .from(financeiro)
                .where(
                    and(
                        eq(financeiro.id_venda, input.id_venda),
                        eq(financeiro.parcela, input.parcela)
                    )
                );
            // Soma dos valores
            const valorTotal = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);
            // Atualiza valor da principal
            await ctx.db.update(financeiro)
                .set({ valor: String(valorTotal) })
                .where(eq(financeiro.id, input.id_financeiro));
            // Remove filhas (exceto principal)
            await ctx.db.delete(financeiro)
                .where(
                    and(
                        eq(financeiro.id_venda, input.id_venda),
                        eq(financeiro.parcela, input.parcela),
                        sql`id <> ${input.id_financeiro}`
                    )
                );
            return { ok: true, valorRestaurado: valorTotal };
        }),
    /* ============= Remover parcela filha ============= */
    removerParcelaFilha: adminProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            // Remove todas as parcelas com mesmo número, exceto a principal (independente de data_pagamento ou deleted_at)
            const result = await ctx.db.delete(financeiro)
                .where(
                    and(
                        eq(financeiro.id_venda, input.id_venda),
                        eq(financeiro.parcela, input.parcela),
                        sql`id <> ${input.id_financeiro}`
                    )
                );
            return { ok: true, deleted: result };
        }),
    /* ============= Listagem ============= */
    list: protectedProcedure
        .input(
            z.object({
                status: z.enum(['ATIVA', 'ENCERRADA']).optional(),
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [
                eq(vendas.id_unidade, ctx.session.unidadeId),
                isNull(vendas.deleted_at),
            ];
            if (input?.status) whereParts.push(eq(vendas.status, input.status));

            const rows = await ctx.db
                .select({
                    id: vendas.id,
                    id_pessoa: vendas.id_pessoa,
                    id_servico: vendas.id_servico,
                    id_pacote: vendas.id_pacote,
                    id_forma_pagamento: vendas.id_forma_pagamento,
                    quantidade_sessoes: vendas.quantidade_sessoes,
                    valor: vendas.valor,
                    data_venda: vendas.data_venda,
                    quantidade_parcelas: vendas.quantidade_parcelas,
                    observacao: vendas.observacao,
                    status: vendas.status,
                    motivo_encerramento: vendas.motivo_encerramento,
                    created_at: vendas.created_at,
                    pessoa_nome: pessoas.nome,
                    servico_nome: servicos.nome,
                    pacote_nome: pacotes.nome,
                    forma_pagamento_nome: formasPagamento.nome,
                    temPagamento: sql<boolean>`EXISTS(SELECT 1 FROM financeiro f WHERE f.id_venda = ${vendas.id} AND f.data_pagamento IS NOT NULL)`.as('tem_pagamento'),
                    temAtendimento: sql<boolean>`EXISTS(SELECT 1 FROM atendimentos a WHERE a.id_venda = ${vendas.id})`.as('tem_atendimento'),
                    sessoes_realizadas: sql<number>`(SELECT COUNT(*) FROM atendimentos a WHERE a.id_venda = ${vendas.id} AND a.status = 'REALIZADO')`.as('sessoes_realizadas'),
                })
                .from(vendas)
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(servicos, eq(vendas.id_servico, servicos.id))
                .leftJoin(pacotes, eq(vendas.id_pacote, pacotes.id))
                .innerJoin(formasPagamento, eq(vendas.id_forma_pagamento, formasPagamento.id))
                .where(and(...whereParts))
                .orderBy(vendas.created_at);

            return rows.map((r) => ({
                ...r,
                temPagamento: Boolean(r.temPagamento),
                temAtendimento: Boolean(r.temAtendimento),
                sessoes_realizadas: Number(r.sessoes_realizadas) || 0,
                canDelete: !r.temPagamento && !r.temAtendimento,
                canClose: Boolean(r.temPagamento) || Boolean(r.temAtendimento),
            }));
        }),

    /* ============= Detalhe ============= */
    getById: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({
                    id: vendas.id,
                    id_pessoa: vendas.id_pessoa,
                    id_servico: vendas.id_servico,
                    id_pacote: vendas.id_pacote,
                    id_forma_pagamento: vendas.id_forma_pagamento,
                    quantidade_sessoes: vendas.quantidade_sessoes,
                    valor: vendas.valor,
                    data_venda: vendas.data_venda,
                    quantidade_parcelas: vendas.quantidade_parcelas,
                    observacao: vendas.observacao,
                    status: vendas.status,
                    motivo_encerramento: vendas.motivo_encerramento,
                    pessoa_nome: pessoas.nome,
                    servico_nome: servicos.nome,
                    pacote_nome: pacotes.nome,
                    forma_pagamento_nome: formasPagamento.nome,
                })
                .from(vendas)
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(servicos, eq(vendas.id_servico, servicos.id))
                .leftJoin(pacotes, eq(vendas.id_pacote, pacotes.id))
                .innerJoin(formasPagamento, eq(vendas.id_forma_pagamento, formasPagamento.id))
                .where(
                    and(
                        eq(vendas.id, input.id),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
            return row;
        }),

    /* ============= Criação (lançar venda) ============= */
    create: adminProcedure
        .input(
            z.object({
                id_pessoa: z.number().int().positive(),
                id_servico: z.number().int().positive().optional(),
                id_pacote: z.number().int().positive().optional(),
                id_forma_pagamento: z.number().int().positive(),
                quantidade_sessoes: z.number().int().positive(),
                valor: z.number().positive(),
                data_venda: z.string().min(1),
                data_primeiro_vencimento: z.string().min(1),
                quantidade_parcelas: z.number().int().positive().default(1),
                observacao: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            console.log("INPUT:", input);
            /* Validações de regra de negócio */
            if (!input.id_servico && !input.id_pacote) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe serviço ou pacote' });
            }
            if (input.id_servico && input.id_pacote) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe apenas serviço OU pacote' });
            }

            const hoje = toDateStr(new Date());
            if (input.data_venda > hoje) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data da venda não pode ser futura' });
            }
            if (input.data_primeiro_vencimento < input.data_venda) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Data do primeiro vencimento deve ser igual ou posterior à data da venda',
                });
            }

            /* Validar pessoa */
            const [pessoa] = await ctx.db
                .select({ id: pessoas.id })
                .from(pessoas)
                .where(
                    and(
                        eq(pessoas.id, input.id_pessoa),
                        eq(pessoas.id_unidade, ctx.session.unidadeId),
                        isNull(pessoas.deleted_at),
                        eq(pessoas.status, 'ATIVO'),
                    ),
                )
                .limit(1);
            if (!pessoa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pessoa não encontrada' });

            /* Validar forma de pagamento */
            const [fp] = await ctx.db
                .select({ id: formasPagamento.id })
                .from(formasPagamento)
                .where(and(eq(formasPagamento.id, input.id_forma_pagamento), eq(formasPagamento.ativo, true)))
                .limit(1);
            if (!fp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Forma de pagamento não encontrada' });

            /* Validar serviço ou pacote */
            if (input.id_servico) {
                const [srv] = await ctx.db
                    .select({ id: servicos.id })
                    .from(servicos)
                    .where(and(eq(servicos.id, input.id_servico), eq(servicos.ativo, true)))
                    .limit(1);
                if (!srv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
            }
            if (input.id_pacote) {
                const [pkt] = await ctx.db
                    .select({ id: pacotes.id })
                    .from(pacotes)
                    .where(and(eq(pacotes.id, input.id_pacote), eq(pacotes.status, 'ativo')))
                    .limit(1);
                if (!pkt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pacote não encontrado' });
            }

            /* Criar venda + parcelas em transação */
            return ctx.db.transaction(async (tx) => {
                const ids = await tx.insert(vendas).values({
                    id_pessoa: input.id_pessoa,
                    id_servico: input.id_servico ?? null,
                    id_pacote: input.id_pacote ?? null,
                    id_forma_pagamento: input.id_forma_pagamento,
                    id_unidade: ctx.session.unidadeId,
                    quantidade_sessoes: input.quantidade_sessoes,
                    valor: String(input.valor) as any,
                    data_venda: normalizeDateOnly(input.data_venda),
                    quantidade_parcelas: input.quantidade_parcelas,
                    observacao: input.observacao || null,
                    status: 'ATIVA',
                }).$returningId();

                const vendaId = ids[0]?.id;

                /* Gerar parcelas no financeiro */
                const numParcelas = input.quantidade_parcelas;
                const valorParcela = Math.round((input.valor / numParcelas) * 100) / 100;
                const dataVenda = normalizeDateOnly(input.data_venda);
                const primVenc = normalizeDateOnly(input.data_primeiro_vencimento);

                for (let i = 0; i < numParcelas; i++) {
                    const vencimento = new Date(primVenc);
                    vencimento.setMonth(vencimento.getMonth() + i);

                    // Última parcela ajusta centavos
                    const vlr =
                        i === numParcelas - 1
                            ? input.valor - valorParcela * (numParcelas - 1)
                            : valorParcela;

                    await tx.insert(financeiro).values({
                        id_venda: vendaId,
                        parcela: i + 1,
                        valor: String(Math.round(vlr * 100) / 100) as any,
                        data_lancamento: dataVenda,
                        data_vencimento: vencimento,
                        status: 'PENDENTE',
                    });
                }

                return { id: vendaId };
            });
        }),

    /* ============= Atualizar observação ============= */
    updateObservacao: adminProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                observacao: z.string().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id, input.id),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });

            await ctx.db
                .update(vendas)
                .set({ observacao: input.observacao, updated_at: new Date() })
                .where(eq(vendas.id, input.id));
            return { ok: true };
        }),

    /* ============= Encerrar venda ============= */
    encerrar: adminProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                motivo_encerramento: z.string().min(1, 'Informe o motivo do encerramento'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: vendas.id, status: vendas.status })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id, input.id),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
            if (row.status === 'ENCERRADA') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Venda já está encerrada' });
            }

            await ctx.db.transaction(async (tx) => {
                await tx
                    .update(vendas)
                    .set({
                        status: 'ENCERRADA',
                        motivo_encerramento: input.motivo_encerramento,
                        updated_at: new Date(),
                    })
                    .where(eq(vendas.id, input.id));

                // Cancelar parcelas não pagas
                await tx
                    .update(financeiro)
                    .set({ status: 'CANCELADO' })
                    .where(
                        and(
                            eq(financeiro.id_venda, input.id),
                            eq(financeiro.status, 'PENDENTE'),
                        ),
                    );
            });

            return { ok: true };
        }),

    /* ============= Excluir venda ============= */
    delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id, input.id),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });

            // Checar se pode excluir
            const [pago] = await ctx.db
                .select({ cnt: count() })
                .from(financeiro)
                .where(
                    and(eq(financeiro.id_venda, input.id), isNotNull(financeiro.data_pagamento)),
                );
            if (Number(pago?.cnt) > 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Não é possível excluir: existem pagamentos registrados',
                });
            }

            const [atd] = await ctx.db
                .select({ cnt: count() })
                .from(atendimentos)
                .where(eq(atendimentos.id_venda, input.id));
            if (Number(atd?.cnt) > 0) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'Não é possível excluir: existem atendimentos vinculados',
                });
            }

            await ctx.db.transaction(async (tx) => {
                await tx.delete(financeiro).where(eq(financeiro.id_venda, input.id));
                await tx.delete(vendas).where(eq(vendas.id, input.id));
            });

            return { ok: true };
        }),

    /* ============= Parcelas (financeiro da venda) ============= */
    listParcelas: protectedProcedure
        .input(z.object({ id_venda: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            // Validar acesso à venda
            const [v] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id, input.id_venda),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });

            return ctx.db
                .select({
                    id: financeiro.id,
                    parcela: financeiro.parcela,
                    valor: financeiro.valor,
                    data_vencimento: financeiro.data_vencimento,
                    data_pagamento: financeiro.data_pagamento,
                    status: financeiro.status,
                })
                .from(financeiro)
                .where(eq(financeiro.id_venda, input.id_venda))
                .orderBy(financeiro.parcela, financeiro.data_vencimento);
        }),

    /* ============= Registrar pagamento ============= */
    registrarPagamento: adminProcedure
        .input(
            z.object({
                id_financeiro: z.number().int().positive(),
                data_pagamento: z.union([z.string(), z.null()]), // string = registrar data; null = remover pagamento
                parcial: z.boolean().default(false),
                valor_pago: z.number().positive().optional(),
                novo_vencimento: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            /* Buscar parcela e validar acesso */
            const [parcela] = await ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    parcela: financeiro.parcela,
                    valor: financeiro.valor,
                    data_pagamento: financeiro.data_pagamento,
                    status: financeiro.status,
                })
                .from(financeiro)
                .where(eq(financeiro.id, input.id_financeiro))
                .limit(1);

            if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            if (parcela.status === 'CANCELADO') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Parcela está cancelada' });
            }

            // Validar acesso via venda e obter data_venda para validação
            let dataVenda: Date | null = null;
            if (parcela.id_venda) {
                const [v] = await ctx.db
                    .select({ id: vendas.id, data_venda: vendas.data_venda })
                    .from(vendas)
                    .where(
                        and(
                            eq(vendas.id, parcela.id_venda),
                            eq(vendas.id_unidade, ctx.session.unidadeId),
                        ),
                    )
                    .limit(1);
                if (!v) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem acesso a esta venda' });
                dataVenda = v.data_venda;
            }

            let dtPgto: Date | undefined = undefined;
            if (input.data_pagamento && typeof input.data_pagamento === 'string') {
                dtPgto = normalizeDateOnly(input.data_pagamento);
                // Data de pagamento não pode ser anterior à data da venda
                if (dataVenda) {
                    const vendaStr = toDateStr(dataVenda instanceof Date ? dataVenda : new Date(String(dataVenda)));
                    const pgtoStr = toDateStr(dtPgto);
                    if (pgtoStr < vendaStr) {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'A data de pagamento não pode ser menor que a data da venda',
                        });
                    }
                }
            }
            const valorParcela = Number(parcela.valor);

            if (!input.parcial) {
                /* Pagamento integral ou remoção de pagamento */
                await ctx.db
                    .update(financeiro)
                    .set({
                        data_pagamento: input.data_pagamento === null ? null : dtPgto,
                        status: input.data_pagamento === null ? 'PENDENTE' : 'PAGO',
                    })
                    .where(eq(financeiro.id, input.id_financeiro));

                return { ok: true };
            }

            /* Pagamento parcial */
            if (!input.valor_pago) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe o valor pago' });
            }
            if (!input.novo_vencimento) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe o novo vencimento' });
            }
            if (input.valor_pago >= valorParcela) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Valor pago deve ser menor que o valor da parcela',
                });
            }

            const novoVenc = normalizeDateOnly(input.novo_vencimento);
            const valorRestante = Math.round((valorParcela - input.valor_pago) * 100) / 100;

            await ctx.db.transaction(async (tx) => {
                // Atualizar parcela original: registra o valor pago
                await tx
                    .update(financeiro)
                    .set({
                        valor: String(input.valor_pago) as any,
                        data_pagamento: dtPgto,
                        status: 'PAGO',
                    })
                    .where(eq(financeiro.id, input.id_financeiro));

                // Criar parcela com valor restante
                await tx.insert(financeiro).values({
                    id_venda: parcela.id_venda,
                    parcela: parcela.parcela, // mesmo número para identificação
                    valor: String(valorRestante) as any,
                    data_lancamento: dtPgto || new Date(),
                    data_vencimento: novoVenc,
                    status: 'PENDENTE',
                });
            });

            return { ok: true, valor_restante: valorRestante };
        }),

    /* ============= Atendimentos da venda ============= */
    listAtendimentos: protectedProcedure
        .input(z.object({ id_venda: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const [v] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        eq(vendas.id, input.id_venda),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });

            const { usuarios } = await import('../../drizzle/schema');

            return ctx.db
                .select({
                    id: atendimentos.id,
                    data: atendimentos.data,
                    hora_inicio: atendimentos.hora_inicio,
                    hora_fim: atendimentos.hora_fim,
                    status: atendimentos.status,
                    observacoes: atendimentos.observacoes,
                    profissional_nome: usuarios.nome,
                })
                .from(atendimentos)
                .innerJoin(usuarios, eq(atendimentos.id_profissional, usuarios.id))
                .where(eq(atendimentos.id_venda, input.id_venda))
                .orderBy(atendimentos.data, atendimentos.hora_inicio);
        }),
});
