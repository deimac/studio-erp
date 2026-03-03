import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
    receitasDespesas,
    pessoas,
    financeiro,
    formasPagamento,
    categoriasReceitasDespesas,
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

export const receitasDespesasRouter = createTRPCRouter({
    /** Listar categorias */
    listCategorias: protectedProcedure
        .input(z.object({ tipo: z.enum(['RECEITA', 'DESPESA']).optional() }).optional())
        .query(async ({ ctx, input }) => {
            if (input?.tipo) {
                return await ctx.db.select().from(categoriasReceitasDespesas).where(eq(categoriasReceitasDespesas.tipo, input.tipo));
            }
            return await ctx.db.select().from(categoriasReceitasDespesas);
        }),

    /** Criar receita ou despesa */
    create: adminProcedure
        .input(
            z.object({
                id_pessoa: z.number().int().positive(),
                tipo: z.enum(['RECEITA', 'DESPESA']),
                descricao: z.string().min(1),
                valor: z.number().positive(),
                data_lancamento: z.string(),
                data_primeiro_vencimento: z.string(),
                id_forma_pagamento: z.number().int().positive(),
                id_categoria: z.number().int().positive(),
                quantidade_parcelas: z.number().int().positive().default(1),
                observacao: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const {
                id_pessoa,
                tipo,
                descricao,
                valor,
                data_lancamento,
                data_primeiro_vencimento,
                id_forma_pagamento,
                id_categoria,
                quantidade_parcelas,
                observacao,
            } = input;

            // Validar pessoa
            const pessoa = await ctx.db
                .select()
                .from(pessoas)
                .where(eq(pessoas.id, id_pessoa))
                .limit(1);
            if (!pessoa[0]) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Pessoa não encontrada' });
            }

            // Validar forma de pagamento
            const forma = await ctx.db
                .select()
                .from(formasPagamento)
                .where(eq(formasPagamento.id, id_forma_pagamento))
                .limit(1);
            if (!forma[0]) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Forma de pagamento não encontrada' });
            }

            // Validar categoria
            const categoria = await ctx.db
                .select()
                .from(categoriasReceitasDespesas)
                .where(eq(categoriasReceitasDespesas.id, id_categoria))
                .limit(1);
            if (!categoria[0]) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoria não encontrada' });
            }

            const dataLancamento = normalizeDateOnly(data_lancamento);
            const dataPrimVenc = normalizeDateOnly(data_primeiro_vencimento);

            // Inserir receita/despesa
            const [rd] = await ctx.db.insert(receitasDespesas).values({
                id_pessoa,
                tipo,
                descricao,
                valor: String(valor),
                data_lancamento: dataLancamento,
                id_forma_pagamento,
                id_categorias_receitas_despesas: id_categoria,
                quantidade_parcelas,
                observacao,
            });

            const idReceitaDespesa = Number(rd.insertId);

            // Gerar parcelas no financeiro
            const valorParcela = valor / quantidade_parcelas;

            for (let i = 0; i < quantidade_parcelas; i++) {
                const dataVenc = new Date(dataPrimVenc);
                dataVenc.setMonth(dataVenc.getMonth() + i);

                await ctx.db.insert(financeiro).values({
                    id_receita_despesa: idReceitaDespesa,
                    valor: String(valorParcela.toFixed(2)),
                    data_lancamento: dataLancamento,
                    data_vencimento: dataVenc,
                    data_pagamento: null,
                    parcela: i + 1,
                    status: 'PENDENTE',
                });
            }

            return { id: idReceitaDespesa };
        }),

    /** Criar categoria */
    createCategoria: adminProcedure
        .input(z.object({ nome: z.string().min(1), tipo: z.enum(['RECEITA', 'DESPESA']) }))
        .mutation(async ({ ctx, input }) => {
            const [cat] = await ctx.db.insert(categoriasReceitasDespesas).values({
                nome: input.nome,
                tipo: input.tipo,
            });
            return { id: Number(cat.insertId) };
        }),

    /** Atualizar categoria */
    updateCategoria: adminProcedure
        .input(z.object({ id: z.number().int().positive(), nome: z.string().min(1), tipo: z.enum(['RECEITA', 'DESPESA']) }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.update(categoriasReceitasDespesas)
                .set({ nome: input.nome, tipo: input.tipo })
                .where(eq(categoriasReceitasDespesas.id, input.id));
            return { success: true };
        }),

    /** Deletar categoria */
    deleteCategoria: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(categoriasReceitasDespesas)
                .where(eq(categoriasReceitasDespesas.id, input.id));
            return { success: true };
        }),
});
