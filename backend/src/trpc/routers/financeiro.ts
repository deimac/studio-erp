import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { financeiro, vendas, pessoas, formasPagamento, receitasDespesas } from '../../drizzle/schema';
import { rotuloVenda, vendaTemPacote } from '../vendaItens';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { condDono, podeGerenciar, zEscopo, type Escopo, type Sessao } from '../../lib/escopo';
import { vendaGerenciavel, type DbOuTx } from '../acesso';

/* ── helpers ─────────────────────────────────────────────── */

function normalizeDateOnly(value: string) {
    const datePart = value.includes('T') ? value.split('T')[0] : value;
    const d = new Date(`${datePart}T00:00:00`);
    if (isNaN(d.getTime())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data inválida' });
    return d;
}

/** Parcela da unidade que o usuário pode alterar (venda ou lançamento dele; admin: todas). */
async function parcelaGerenciavel(db: DbOuTx, s: Sessao & { unidadeId: number }, idFinanceiro: number) {
    const [p] = await db
        .select({ id: financeiro.id, id_venda: financeiro.id_venda, id_receita_despesa: financeiro.id_receita_despesa })
        .from(financeiro)
        .where(eq(financeiro.id, idFinanceiro))
        .limit(1);
    if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
    if (p.id_venda) {
        await vendaGerenciavel(db, s, p.id_venda);
    } else if (p.id_receita_despesa) {
        const [rd] = await db
            .select({ dono: receitasDespesas.id_profissional })
            .from(receitasDespesas)
            .where(eq(receitasDespesas.id, p.id_receita_despesa))
            .limit(1);
        if (!rd || !podeGerenciar(rd.dono, s)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
    }
}

/* ── router ──────────────────────────────────────────────── */

export const financeiroRouter = createTRPCRouter({
    /**
     * Listagem geral do financeiro (visão admin).
     * Traz todas as parcelas de vendas da unidade.
     */
    list: protectedProcedure
        .input(
            z.object({
                status: z.enum(['PENDENTE', 'PAGO', 'CANCELADO']).optional(),
                id_venda: z.number().int().positive().optional(),
                escopo: zEscopo,
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [eq(vendas.id_unidade, ctx.session.unidadeId)];
            const escopo: Escopo | undefined = input?.escopo;
            whereParts.push(condDono(vendas.id_profissional, ctx.session, escopo)); // and() ignora undefined
            if (input?.status) whereParts.push(eq(financeiro.status, input.status));
            if (input?.id_venda) whereParts.push(eq(financeiro.id_venda, input.id_venda));

            return ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    parcela: financeiro.parcela,
                    valor: financeiro.valor,
                    data_lancamento: financeiro.data_lancamento,
                    data_vencimento: financeiro.data_vencimento,
                    data_pagamento: financeiro.data_pagamento,
                    status: financeiro.status,
                    pessoa_nome: pessoas.nome,
                    forma_pagamento_nome: formasPagamento.nome,
                })
                .from(financeiro)
                .innerJoin(vendas, eq(financeiro.id_venda, vendas.id))
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(formasPagamento, eq(formasPagamento.id, sql`COALESCE(${financeiro.id_forma_pagamento}, ${vendas.id_forma_pagamento})`))
                .where(and(...whereParts))
                .orderBy(financeiro.data_vencimento);
        }),

    /** Listagem detalhada com dados de vendas e receitas/despesas unificadas */
    listWithDetails: protectedProcedure
        .input(z.object({
            tipo: z.enum(['RECEITA', 'DESPESA']),
            id_pessoa: z.number().int().positive().optional(),
            situacao: z.enum(['TODOS', 'PAGO', 'NAO_PAGO']).default('TODOS'),
            dataType: z.enum(['VENCIMENTO', 'PAGAMENTO']).default('VENCIMENTO'),
            dataInicio: z.string().optional(),
            dataFim: z.string().optional(),
            escopo: zEscopo,
        }))
        .query(async ({ ctx, input }) => {
            // Profissional vê só as vendas e lançamentos dele; admin escolhe Geral / Só meu
            const escopo: Escopo | undefined = input.escopo;
            // Query para VENDAS (para tipo RECEITA)
            let vendasData: any[] = [];
            if (input.tipo === 'RECEITA') {
                const vendaWhereParts: any[] = [
                    isNotNull(financeiro.id_venda),
                    eq(vendas.id_unidade, ctx.session.unidadeId),
                ];
                vendaWhereParts.push(condDono(vendas.id_profissional, ctx.session, escopo)); // and() ignora undefined

                // Filtro de situação
                if (input.situacao === 'PAGO') {
                    vendaWhereParts.push(isNotNull(financeiro.data_pagamento));
                } else if (input.situacao === 'NAO_PAGO') {
                    vendaWhereParts.push(isNull(financeiro.data_pagamento));
                }

                // Filtro de pessoa
                if (input.id_pessoa) {
                    vendaWhereParts.push(eq(vendas.id_pessoa, input.id_pessoa));
                }

                // Filtros de data
                if (input.dataInicio) {
                    const dataField = input.dataType === 'PAGAMENTO' ? financeiro.data_pagamento : financeiro.data_vencimento;
                    vendaWhereParts.push(sql`date(${dataField}) >= ${input.dataInicio}`);
                }
                if (input.dataFim) {
                    const dataField = input.dataType === 'PAGAMENTO' ? financeiro.data_pagamento : financeiro.data_vencimento;
                    vendaWhereParts.push(sql`date(${dataField}) <= ${input.dataFim}`);
                }

                const vendaRows = await ctx.db
                    .select({
                        id: financeiro.id,
                        id_venda: financeiro.id_venda,
                        id_receita_despesa: financeiro.id_receita_despesa,
                        cliente_nome: pessoas.nome,
                        cliente_id: pessoas.id,
                        servico_nome: sql<string | null>`IF(${vendaTemPacote(vendas.id)}, NULL, ${rotuloVenda(vendas.id)})`.as('servico_nome'),
                        pacote_nome: sql<string | null>`IF(${vendaTemPacote(vendas.id)}, ${rotuloVenda(vendas.id)}, NULL)`.as('pacote_nome'),
                        parcela: financeiro.parcela,
                        forma_pagamento_nome: formasPagamento.nome,
                        id_forma_pagamento: formasPagamento.id,
                        data_lancamento: financeiro.data_lancamento,
                        data_vencimento: financeiro.data_vencimento,
                        data_pagamento: financeiro.data_pagamento,
                        valor: financeiro.valor,
                        status: financeiro.status,
                        quantidade_parcelas: vendas.quantidade_parcelas,
                    })
                    .from(financeiro)
                    .innerJoin(vendas, eq(financeiro.id_venda, vendas.id))
                    .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                    .leftJoin(formasPagamento, eq(formasPagamento.id, sql`COALESCE(${financeiro.id_forma_pagamento}, ${vendas.id_forma_pagamento})`))
                    .where(and(...vendaWhereParts));

                vendasData = vendaRows.map((row: any) => ({ ...row, sourceType: 'VENDA' }));
            }

            // Query para RECEITAS_DESPESAS
            const rdWhereParts: any[] = [
                isNotNull(financeiro.id_receita_despesa),
                eq(receitasDespesas.tipo, input.tipo),
                eq(pessoas.id_unidade, ctx.session.unidadeId),
            ];
            rdWhereParts.push(condDono(receitasDespesas.id_profissional, ctx.session, escopo)); // and() ignora undefined

            // Filtro de situação
            if (input.situacao === 'PAGO') {
                rdWhereParts.push(isNotNull(financeiro.data_pagamento));
            } else if (input.situacao === 'NAO_PAGO') {
                rdWhereParts.push(isNull(financeiro.data_pagamento));
            }

            // Filtro de pessoa
            if (input.id_pessoa) {
                rdWhereParts.push(eq(receitasDespesas.id_pessoa, input.id_pessoa));
            }

            // Filtros de data
            if (input.dataInicio) {
                const dataField = input.dataType === 'PAGAMENTO' ? financeiro.data_pagamento : financeiro.data_vencimento;
                rdWhereParts.push(sql`date(${dataField}) >= ${input.dataInicio}`);
            }
            if (input.dataFim) {
                const dataField = input.dataType === 'PAGAMENTO' ? financeiro.data_pagamento : financeiro.data_vencimento;
                rdWhereParts.push(sql`date(${dataField}) <= ${input.dataFim}`);
            }

            const rdRows = await ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    id_receita_despesa: financeiro.id_receita_despesa,
                    cliente_nome: pessoas.nome,
                    cliente_id: pessoas.id,
                    descricao: receitasDespesas.descricao,
                    servico_nome: sql<string | null>`NULL`.as('servico_nome'),
                    pacote_nome: sql<string | null>`NULL`.as('pacote_nome'),
                    parcela: financeiro.parcela,
                    forma_pagamento_nome: formasPagamento.nome,
                    id_forma_pagamento: formasPagamento.id,
                    data_lancamento: financeiro.data_lancamento,
                    data_vencimento: financeiro.data_vencimento,
                    data_pagamento: financeiro.data_pagamento,
                    valor: financeiro.valor,
                    status: financeiro.status,
                    quantidade_parcelas: receitasDespesas.quantidade_parcelas,
                })
                .from(financeiro)
                .innerJoin(receitasDespesas, eq(financeiro.id_receita_despesa, receitasDespesas.id))
                .innerJoin(pessoas, eq(receitasDespesas.id_pessoa, pessoas.id))
                .leftJoin(formasPagamento, eq(formasPagamento.id, sql`COALESCE(${financeiro.id_forma_pagamento}, ${receitasDespesas.id_forma_pagamento})`))
                .where(and(...rdWhereParts));

            const rdData = rdRows.map((row: any) => ({ ...row, sourceType: 'RECEITA_DESPESA' }));

            // Combinar e ordenar
            const allData = [...vendasData, ...rdData].sort((a, b) => {
                const dataA = new Date(a.data_vencimento || 0).getTime();
                const dataB = new Date(b.data_vencimento || 0).getTime();
                return dataB - dataA;
            });

            return allData;
        }),

    /** Atualizar status de pagamento de uma parcela (suporta pagamento parcial) */
    updateParcela: protectedProcedure
        .input(z.object({
            id: z.number().int().positive(),
            data_pagamento: z.string().optional(), // date string ou undefined para desmarcar
            parcial: z.boolean().default(false),
            valor_pago: z.number().positive().optional(),
            novo_vencimento: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            await parcelaGerenciavel(ctx.db, ctx.session, input.id);
            // Buscar parcela para validação e dados necessários para pagamento parcial
            const [parcela] = await ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    id_receita_despesa: financeiro.id_receita_despesa,
                    parcela: financeiro.parcela,
                    valor: financeiro.valor,
                    status: financeiro.status,
                })
                .from(financeiro)
                .where(eq(financeiro.id, input.id))
                .limit(1);

            if (!parcela) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            }
            if (parcela.status === 'CANCELADO') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Parcela está cancelada' });
            }

            // Remover pagamento
            if (!input.data_pagamento) {
                await ctx.db
                    .update(financeiro)
                    .set({
                        data_pagamento: null,
                        status: 'PENDENTE',
                    })
                    .where(eq(financeiro.id, input.id));
                return { success: true };
            }

            // Converter data para formato correto
            const dtPgto = normalizeDateOnly(input.data_pagamento);
            const valorParcela = Number(parcela.valor);

            // Pagamento integral
            if (!input.parcial) {
                await ctx.db
                    .update(financeiro)
                    .set({
                        data_pagamento: dtPgto,
                        status: 'PAGO',
                    })
                    .where(eq(financeiro.id, input.id));
                return { success: true };
            }

            // Pagamento parcial
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
                    .where(eq(financeiro.id, input.id));

                // Criar parcela com valor restante
                await tx.insert(financeiro).values({
                    id_venda: parcela.id_venda,
                    id_receita_despesa: parcela.id_receita_despesa,
                    parcela: parcela.parcela, // mesmo número para identificação
                    valor: String(valorRestante) as any,
                    data_lancamento: dtPgto,
                    data_vencimento: novoVenc,
                    status: 'PENDENTE',
                });
            });

            return { success: true, valor_restante: valorRestante };
        }),

    /**
     * Editar uma parcela: vencimento, valor e forma de pagamento.
     * Parcela paga só troca vencimento e forma (o valor já foi recebido).
     */
    editarParcela: protectedProcedure
        .input(z.object({
            id: z.number().int().positive(),
            data_vencimento: z.string().min(1),
            valor: z.number().positive(),
            id_forma_pagamento: z.number().int().positive().nullable(),
        }))
        .mutation(async ({ ctx, input }) => {
            await parcelaGerenciavel(ctx.db, ctx.session, input.id);
            const [p] = await ctx.db
                .select({ id: financeiro.id, valor: financeiro.valor, status: financeiro.status, id_venda: financeiro.id_venda })
                .from(financeiro)
                .where(eq(financeiro.id, input.id))
                .limit(1);
            if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            if (p.status === 'CANCELADO') throw new TRPCError({ code: 'CONFLICT', message: 'Parcela cancelada não pode ser editada' });
            const valorMudou = Math.round(Number(p.valor) * 100) !== Math.round(input.valor * 100);
            if (p.status === 'PAGO' && valorMudou)
                throw new TRPCError({ code: 'CONFLICT', message: 'Esta parcela já foi paga. Para mudar o valor, desmarque o pagamento primeiro.' });
            if (input.id_forma_pagamento) {
                const [fp] = await ctx.db
                    .select({ id: formasPagamento.id })
                    .from(formasPagamento)
                    .where(eq(formasPagamento.id, input.id_forma_pagamento))
                    .limit(1);
                if (!fp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Forma de pagamento não encontrada' });
            }
            await ctx.db
                .update(financeiro)
                .set({
                    data_vencimento: normalizeDateOnly(input.data_vencimento),
                    valor: String(Math.round(input.valor * 100) / 100) as any,
                    id_forma_pagamento: input.id_forma_pagamento,
                })
                .where(eq(financeiro.id, input.id));
            return { ok: true };
        }),

    /** Atualizar valor da parcela principal (soma todas as filhas) */
    atualizarValorParcelaPrincipal: protectedProcedure
        .input(z.object({
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            await parcelaGerenciavel(ctx.db, ctx.session, input.id_financeiro);
            // Buscar parcela principal para saber os IDs referência
            const [principal] = await ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    id_receita_despesa: financeiro.id_receita_despesa,
                    parcela: financeiro.parcela,
                })
                .from(financeiro)
                .where(eq(financeiro.id, input.id_financeiro))
                .limit(1);

            if (!principal) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            }

            // Buscar todas as parcelas com mesmo número (principal + filhas)
            const whereParts: any[] = [eq(financeiro.parcela, principal.parcela)];
            if (principal.id_venda) {
                whereParts.push(eq(financeiro.id_venda, principal.id_venda));
            } else if (principal.id_receita_despesa) {
                whereParts.push(eq(financeiro.id_receita_despesa, principal.id_receita_despesa));
            }

            const parcelas = await ctx.db
                .select({ id: financeiro.id, valor: financeiro.valor })
                .from(financeiro)
                .where(and(...whereParts));

            // Soma dos valores
            const valorTotal = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);

            // Atualiza valor da principal
            await ctx.db
                .update(financeiro)
                .set({ valor: String(valorTotal) as any })
                .where(eq(financeiro.id, input.id_financeiro));

            return { ok: true, valorRestaurado: valorTotal };
        }),

    /** Remover parcelas filhas (exceto a principal) */
    removerParcelaFilha: protectedProcedure
        .input(z.object({
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            await parcelaGerenciavel(ctx.db, ctx.session, input.id_financeiro);
            // Buscar parcela principal para saber os IDs referência
            const [principal] = await ctx.db
                .select({
                    id: financeiro.id,
                    id_venda: financeiro.id_venda,
                    id_receita_despesa: financeiro.id_receita_despesa,
                    parcela: financeiro.parcela,
                })
                .from(financeiro)
                .where(eq(financeiro.id, input.id_financeiro))
                .limit(1);

            if (!principal) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            }

            // Montar where para identificar filhas
            const whereParts: any[] = [
                eq(financeiro.parcela, principal.parcela),
                sql`id <> ${input.id_financeiro}`, // exceto a principal
            ];
            if (principal.id_venda) {
                whereParts.push(eq(financeiro.id_venda, principal.id_venda));
            } else if (principal.id_receita_despesa) {
                whereParts.push(eq(financeiro.id_receita_despesa, principal.id_receita_despesa));
            }

            // Remove todas as parcelas filhas
            const result = await ctx.db
                .delete(financeiro)
                .where(and(...whereParts));

            return { ok: true, deleted: result };
        }),
});
