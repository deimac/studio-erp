import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { financeiro, vendas, pessoas, formasPagamento } from '../../drizzle/schema';
import { createTRPCRouter, protectedProcedure } from '../trpc';

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
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [eq(vendas.id_unidade, ctx.session.unidadeId)];
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
                .innerJoin(formasPagamento, eq(vendas.id_forma_pagamento, formasPagamento.id))
                .where(and(...whereParts))
                .orderBy(financeiro.data_vencimento);
        }),
});
