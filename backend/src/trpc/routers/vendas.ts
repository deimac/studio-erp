import { TRPCError } from '@trpc/server';
import { and, eq, isNull, isNotNull, sql, count, or, exists } from 'drizzle-orm';
import { z } from 'zod';
import {
    vendas,
    pessoas,
    servicos,
    pacotes,
    financeiro,
    formasPagamento,
    atendimentos,
    usuarios,
    vendaItens,
} from '../../drizzle/schema';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { podeVerServico, servicoServeParaProfissional } from '../../lib/servicosAcesso';
import { condDono, zEscopo } from '../../lib/escopo';
import { assertAcessoPessoa, usaServicosClinica, vendaGerenciavel, vincularPessoa, type DbOuTx } from '../acesso';
import type { Sessao } from '../../lib/escopo';
import { gravarVenda } from '../vendaGravar';
import { atendimentosDaVenda, dividirParcelas, formasDaVenda, rotuloItem, rotuloVenda, usadasDoItem, vendaTemPacote } from '../vendaItens';

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

/** Campos de nome usados pelas telas: pacote_nome quando há pacote, senão servico_nome. */
function nomesVenda(r: { itens_rotulo: string | null; tem_pacote: unknown; formas_rotulo: string | null; forma_pagamento_nome: string | null }) {
    const temPacote = Boolean(Number(r.tem_pacote));
    return {
        tem_pacote: temPacote,
        pacote_nome: temPacote ? r.itens_rotulo : null,
        servico_nome: temPacote ? null : r.itens_rotulo,
        forma_pagamento_nome: r.formas_rotulo ?? r.forma_pagamento_nome,
    };
}

/* ── validações compartilhadas (lançar e editar venda) ───── */

type Ctx = { db: DbOuTx; session: Sessao & { unidadeId: number } };

const zItem = z.object({
    id_servico: z.number().int().positive().optional(),
    id_pacote: z.number().int().positive().optional(),
    quantidade_sessoes: z.number().int().positive(),
    valor: z.number().positive(),
});
const zPagamento = z.object({
    id_forma_pagamento: z.number().int().positive(),
    valor: z.number().positive(),
    parcelas: z.number().int().positive().max(48).default(1),
    primeiro_vencimento: z.string().min(1),
    /** Já recebido no ato (só pagamento sem parcelamento). */
    pago: z.boolean().default(false),
});

const centavos = (v: number) => Math.round(v * 100);
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Vendedor da venda: só o admin no modo Clínica escolhe outro profissional (ativo, da unidade). */
async function validarVendedor(ctx: Ctx, idProfissional?: number | null): Promise<number> {
    const admin = ctx.session.veTudo;
    if (!admin && idProfissional && idProfissional !== ctx.session.id)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Você só pode lançar vendas suas' });
    const vendedor = admin && idProfissional ? idProfissional : ctx.session.id;
    if (vendedor !== ctx.session.id) {
        const [u] = await ctx.db
            .select({ id: usuarios.id, ativo: usuarios.ativo })
            .from(usuarios)
            .where(and(eq(usuarios.id, vendedor), eq(usuarios.id_unidade, ctx.session.unidadeId)))
            .limit(1);
        if (!u?.ativo) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Profissional inválido ou inativo' });
    }
    return vendedor;
}

function validarItensFormato(itens: { id?: number; id_servico?: number; id_pacote?: number }[]) {
    for (const it of itens) {
        if (it.id) continue;
        if (!it.id_servico === !it.id_pacote)
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cada item é um serviço OU um pacote' });
    }
}

/** Os pagamentos precisam fechar o valor (total da venda ou o que falta receber). */
function conferirPagamentos(alvo: number, pagamentos: { valor: number }[], recebido = 0) {
    const pago = pagamentos.reduce((t, p) => t + centavos(p.valor), 0);
    if (alvo !== pago) {
        const msg = recebido
            ? `Já foram recebidos ${brl(recebido)}; os pagamentos somam ${brl(pago)}, mas faltam ${brl(alvo)}`
            : `Os pagamentos somam ${brl(pago)}, mas a venda é de ${brl(alvo)}`;
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
    }
}

function validarDatas(dataVenda: string, pagamentos: { primeiro_vencimento: string; pago: boolean; parcelas: number }[]) {
    if (dataVenda > toDateStr(new Date())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data da venda não pode ser futura' });
    for (const p of pagamentos) {
        if (p.primeiro_vencimento < dataVenda)
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'O vencimento deve ser igual ou posterior à data da venda' });
        if (p.pago && p.parcelas > 1)
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Só um pagamento à vista pode ser marcado como já recebido' });
    }
}

async function validarPessoa(ctx: Ctx, idPessoa: number) {
    const [pessoa] = await ctx.db
        .select({ id: pessoas.id })
        .from(pessoas)
        .where(and(eq(pessoas.id, idPessoa), eq(pessoas.id_unidade, ctx.session.unidadeId), isNull(pessoas.deleted_at), eq(pessoas.status, 'ATIVO')))
        .limit(1);
    if (!pessoa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pessoa não encontrada' });
    if (!ctx.session.veTudo) await assertAcessoPessoa(ctx.db, ctx.session, idPessoa);
}

async function validarFormas(ctx: Ctx, pagamentos: { id_forma_pagamento: number }[]) {
    for (const p of pagamentos) {
        const [fp] = await ctx.db
            .select({ id: formasPagamento.id })
            .from(formasPagamento)
            .where(and(eq(formasPagamento.id, p.id_forma_pagamento), eq(formasPagamento.ativo, true)))
            .limit(1);
        if (!fp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Forma de pagamento não encontrada' });
    }
}

/** Serviços e pacotes novos: ativos e que o vendedor pode vender. */
async function validarCatalogo(ctx: Ctx, vendedor: number, itens: { id_servico?: number; id_pacote?: number }[]) {
    if (!itens.length) return;
    const usaClinica = await usaServicosClinica(ctx.db, vendedor);
    for (const it of itens) {
        if (it.id_servico) {
            const [srv] = await ctx.db
                .select({ id: servicos.id, dono: servicos.id_profissional })
                .from(servicos)
                .where(and(eq(servicos.id, it.id_servico), eq(servicos.ativo, true)))
                .limit(1);
            if (!srv || !podeVerServico(srv.dono, ctx.session)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
            if (!servicoServeParaProfissional(srv.dono, vendedor, usaClinica))
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Serviço próprio de outro profissional' });
        } else {
            const [pkt] = await ctx.db
                .select({ id: pacotes.id, dono: servicos.id_profissional })
                .from(pacotes)
                .leftJoin(servicos, eq(servicos.id, pacotes.id_servico))
                .where(and(eq(pacotes.id, it.id_pacote!), eq(pacotes.status, 'ativo')))
                .limit(1);
            if (!pkt || !podeVerServico(pkt.dono ?? null, ctx.session)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pacote não encontrado' });
            if (!servicoServeParaProfissional(pkt.dono ?? null, vendedor, usaClinica))
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pacote de serviço próprio de outro profissional' });
        }
    }
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
    /** Verifica se existe venda vinculada a pacote */
    hasVinculoPacote: protectedProcedure
        .input(z.object({ id_pacote: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .select({ id: vendas.id })
                .from(vendas)
                .where(
                    and(
                        or(
                            eq(vendas.id_pacote, input.id_pacote),
                            exists(ctx.db.select({ x: sql`1` }).from(vendaItens).where(and(eq(vendaItens.id_venda, vendas.id), eq(vendaItens.id_pacote, input.id_pacote)))),
                        ),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            return Boolean(row);
        }),
    /* ============= Atualizar valor da parcela principal ============= */
    atualizarValorParcelaPrincipal: protectedProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            await vendaGerenciavel(ctx.db, ctx.session, input.id_venda);
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
    restaurarParcelaOriginal: protectedProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            await vendaGerenciavel(ctx.db, ctx.session, input.id_venda);
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
    removerParcelaFilha: protectedProcedure
        .input(z.object({
            id_venda: z.number().int().positive(),
            parcela: z.number().int().positive(),
            id_financeiro: z.number().int().positive(), // id da parcela principal
        }))
        .mutation(async ({ ctx, input }) => {
            await vendaGerenciavel(ctx.db, ctx.session, input.id_venda);
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
                escopo: zEscopo,
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [
                eq(vendas.id_unidade, ctx.session.unidadeId),
                isNull(vendas.deleted_at),
            ];
            // Profissional vê só as vendas dele; admin escolhe Geral / Só meu
            const dono = condDono(vendas.id_profissional, ctx.session, input?.escopo);
            if (dono) whereParts.push(dono);
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
                    itens_rotulo: rotuloVenda(vendas.id).as('itens_rotulo'),
                    tem_pacote: vendaTemPacote(vendas.id).as('tem_pacote'),
                    formas_rotulo: formasDaVenda(vendas.id).as('formas_rotulo'),
                    forma_pagamento_nome: formasPagamento.nome,
                    id_profissional: vendas.id_profissional,
                    profissional_nome: usuarios.nome,
                    temPagamento: sql<boolean>`EXISTS(SELECT 1 FROM financeiro f WHERE f.id_venda = ${vendas.id} AND f.data_pagamento IS NOT NULL)`.as('tem_pagamento'),
                    temAtendimento: sql<boolean>`EXISTS(SELECT 1 FROM atendimentos a WHERE a.id_venda = ${vendas.id} OR a.id IN ${atendimentosDaVenda(vendas.id)})`.as('tem_atendimento'),
                    sessoes_realizadas: sql<number>`(SELECT COUNT(*) FROM atendimento_itens aix JOIN venda_itens vix ON vix.id = aix.id_venda_item JOIN atendimentos a ON a.id = aix.id_atendimento WHERE vix.id_venda = ${vendas.id} AND a.status = 'REALIZADO')`.as('sessoes_realizadas'),
                })
                .from(vendas)
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(formasPagamento, eq(vendas.id_forma_pagamento, formasPagamento.id))
                .leftJoin(usuarios, eq(usuarios.id, vendas.id_profissional))
                .where(and(...whereParts))
                .orderBy(vendas.created_at);

            return rows.map((r) => ({
                ...r,
                ...nomesVenda(r),
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
            await vendaGerenciavel(ctx.db, ctx.session, input.id);
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
                    itens_rotulo: rotuloVenda(vendas.id).as('itens_rotulo'),
                    tem_pacote: vendaTemPacote(vendas.id).as('tem_pacote'),
                    formas_rotulo: formasDaVenda(vendas.id).as('formas_rotulo'),
                    forma_pagamento_nome: formasPagamento.nome,
                })
                .from(vendas)
                .innerJoin(pessoas, eq(vendas.id_pessoa, pessoas.id))
                .leftJoin(formasPagamento, eq(vendas.id_forma_pagamento, formasPagamento.id))
                .where(
                    and(
                        eq(vendas.id, input.id),
                        eq(vendas.id_unidade, ctx.session.unidadeId),
                        isNull(vendas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Venda não encontrada' });
            const itens = await ctx.db
                .select({
                    id: vendaItens.id,
                    id_servico: vendaItens.id_servico,
                    id_pacote: vendaItens.id_pacote,
                    quantidade_sessoes: vendaItens.quantidade_sessoes,
                    valor: vendaItens.valor,
                    // Nome qualificado: em consulta de uma tabela só o Drizzle omite o prefixo
                    rotulo: rotuloItem(sql.raw('`venda_itens`.`id`')).as('rotulo'),
                    usadas: usadasDoItem(sql.raw('`venda_itens`.`id`')).as('usadas'),
                })
                .from(vendaItens)
                .where(eq(vendaItens.id_venda, input.id))
                .orderBy(vendaItens.id);
            return {
                ...row,
                ...nomesVenda(row),
                itens: itens.map((i) => ({ ...i, usadas: Number(i.usadas), restantes: i.quantidade_sessoes - Number(i.usadas) })),
            };
        }),

    /* ============= Criação (lançar venda) ============= */
    /**
     * Venda com um ou mais itens (serviço avulso ou pacote) e uma ou mais formas
     * de pagamento, cada uma com as suas parcelas. A soma dos pagamentos fecha o total.
     * Admin vende qualquer serviço; profissional vende os da clínica (se liberado) e os próprios.
     */
    create: protectedProcedure
        .input(
            z.object({
                id_pessoa: z.number().int().positive(),
                itens: z.array(zItem).min(1, 'Adicione ao menos um item'),
                pagamentos: z.array(zPagamento).min(1, 'Informe como o cliente vai pagar'),
                data_venda: z.string().min(1),
                observacao: z.string().optional(),
                /** Vendedor: só o admin escolhe; padrão = usuário logado. */
                id_profissional: z.number().int().positive().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const vendedor = await validarVendedor(ctx, input.id_profissional);
            validarItensFormato(input.itens);
            const total = input.itens.reduce((t, i) => t + centavos(i.valor), 0);
            conferirPagamentos(total, input.pagamentos);
            validarDatas(input.data_venda, input.pagamentos);
            await validarPessoa(ctx, input.id_pessoa);
            await validarFormas(ctx, input.pagamentos);
            await validarCatalogo(ctx, vendedor, input.itens);

            /* Criar venda, itens e parcelas em transação */
            return ctx.db.transaction(async (tx) => {
                const id = await gravarVenda(tx, {
                    unidadeId: ctx.session.unidadeId,
                    id_pessoa: input.id_pessoa,
                    vendedor,
                    data_venda: normalizeDateOnly(input.data_venda),
                    observacao: input.observacao,
                    itens: input.itens,
                    pagamentos: input.pagamentos.map((p) => ({ ...p, primeiro_vencimento: normalizeDateOnly(p.primeiro_vencimento) })),
                });
                return { id };
            });
        }),

    /* ============= Edição (venda inteira) ============= */
    /**
     * Edita cliente, data, itens e pagamentos de uma venda ativa.
     * Parcelas já pagas ficam como estão; os pagamentos informados cobrem só o
     * que falta receber e substituem as parcelas em aberto. Sem `pagamentos`,
     * as parcelas em aberto continuam iguais (o total precisa bater).
     * Item com sessão usada não sai e não fica com menos sessões que as usadas.
     */
    update: protectedProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                id_pessoa: z.number().int().positive(),
                itens: z
                    .array(zItem.extend({ id: z.number().int().positive().optional() }))
                    .min(1, 'Adicione ao menos um item'),
                pagamentos: z.array(zPagamento).optional(),
                data_venda: z.string().min(1),
                observacao: z.string().nullable().optional(),
                id_profissional: z.number().int().positive().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const venda = await vendaGerenciavel(ctx.db, ctx.session, input.id);
            if (venda.status !== 'ATIVA') throw new TRPCError({ code: 'CONFLICT', message: 'Venda encerrada não pode ser editada' });
            const [atual] = await ctx.db
                .select({ id_pessoa: vendas.id_pessoa, id_profissional: vendas.id_profissional })
                .from(vendas)
                .where(eq(vendas.id, input.id))
                .limit(1);
            const vendedor = ctx.session.veTudo
                ? await validarVendedor(ctx, input.id_profissional ?? atual!.id_profissional ?? ctx.session.id)
                : atual!.id_profissional ?? ctx.session.id;

            validarItensFormato(input.itens);
            const pagamentos = input.pagamentos;
            validarDatas(input.data_venda, pagamentos ?? []);
            if (input.id_pessoa !== atual!.id_pessoa) await validarPessoa(ctx, input.id_pessoa);
            if (pagamentos) await validarFormas(ctx, pagamentos);
            await validarCatalogo(ctx, vendedor, input.itens.filter((i) => !i.id));

            /* Itens que já existem: sessões usadas */
            const existentes = await ctx.db
                .select({
                    id: vendaItens.id,
                    quantidade_sessoes: vendaItens.quantidade_sessoes,
                    usadas: usadasDoItem(sql.raw('`venda_itens`.`id`')).as('usadas'),
                    rotulo: rotuloItem(sql.raw('`venda_itens`.`id`')).as('rotulo'),
                })
                .from(vendaItens)
                .where(eq(vendaItens.id_venda, input.id));
            const porId = new Map(existentes.map((e) => [e.id, { ...e, usadas: Number(e.usadas) }]));
            for (const it of input.itens) {
                if (!it.id) continue;
                const e = porId.get(it.id);
                if (!e) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Item não pertence a esta venda' });
                if (it.quantidade_sessoes < e.usadas)
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `${e.rotulo ?? 'Item'} já tem ${e.usadas} sessões usadas` });
            }
            const manter = new Set(input.itens.map((i) => i.id).filter(Boolean));
            const removidos = existentes.filter((e) => !manter.has(e.id));
            for (const e of removidos) {
                if (Number(e.usadas) > 0)
                    throw new TRPCError({ code: 'CONFLICT', message: `${e.rotulo ?? 'Item'} já tem sessões usadas e não pode sair da venda` });
            }
            const algumaUsada = existentes.some((e) => Number(e.usadas) > 0);
            if (input.id_pessoa !== atual!.id_pessoa && algumaUsada)
                throw new TRPCError({ code: 'CONFLICT', message: 'Esta venda já tem sessões usadas; não dá para trocar o cliente' });

            /* Parcelas: pagas ficam; em aberto são refeitas (ou mantidas) */
            const parcelas = await ctx.db
                .select({ id: financeiro.id, parcela: financeiro.parcela, valor: financeiro.valor, status: financeiro.status })
                .from(financeiro)
                .where(eq(financeiro.id_venda, input.id));
            const pagas = parcelas.filter((p) => p.status === 'PAGO');
            const abertas = parcelas.filter((p) => p.status === 'PENDENTE');
            const recebido = pagas.reduce((t, p) => t + centavos(Number(p.valor)), 0);
            const emAberto = abertas.reduce((t, p) => t + centavos(Number(p.valor)), 0);
            const total = input.itens.reduce((t, i) => t + centavos(i.valor), 0);
            if (total < recebido)
                throw new TRPCError({ code: 'BAD_REQUEST', message: `O total não pode ficar menor que o já recebido (${brl(recebido)})` });
            if (pagamentos) conferirPagamentos(total - recebido, pagamentos, recebido);
            else if (total !== recebido + emAberto)
                throw new TRPCError({ code: 'BAD_REQUEST', message: `O total mudou para ${brl(total)}: ajuste como o cliente vai pagar` });

            const dataVenda = normalizeDateOnly(input.data_venda);
            await ctx.db.transaction(async (tx) => {
                for (const it of input.itens) {
                    if (it.id) {
                        await tx
                            .update(vendaItens)
                            .set({ quantidade_sessoes: it.quantidade_sessoes, valor: String(it.valor) as any })
                            .where(eq(vendaItens.id, it.id));
                    } else {
                        await tx.insert(vendaItens).values({
                            id_venda: input.id,
                            id_servico: it.id_servico ?? null,
                            id_pacote: it.id_pacote ?? null,
                            quantidade_sessoes: it.quantidade_sessoes,
                            valor: String(it.valor) as any,
                        });
                    }
                }
                for (const e of removidos) await tx.delete(vendaItens).where(eq(vendaItens.id, e.id));

                if (pagamentos) {
                    if (abertas.length) await tx.delete(financeiro).where(and(eq(financeiro.id_venda, input.id), eq(financeiro.status, 'PENDENTE')));
                    let numero = pagas.reduce((m, p) => Math.max(m, p.parcela), 0);
                    for (const p of pagamentos) {
                        const valores = dividirParcelas(p.valor, p.parcelas);
                        for (let i = 0; i < p.parcelas; i++) {
                            numero += 1;
                            const vencimento = normalizeDateOnly(p.primeiro_vencimento);
                            vencimento.setMonth(vencimento.getMonth() + i);
                            await tx.insert(financeiro).values({
                                id_venda: input.id,
                                id_forma_pagamento: p.id_forma_pagamento,
                                parcela: numero,
                                valor: String(valores[i]) as any,
                                data_lancamento: dataVenda,
                                data_vencimento: vencimento,
                                data_pagamento: p.pago ? dataVenda : null,
                                status: p.pago ? 'PAGO' : 'PENDENTE',
                            });
                        }
                    }
                }

                /* Resumo na venda (compatibilidade com telas antigas) */
                const itensFinais = await tx
                    .select({ id_servico: vendaItens.id_servico, id_pacote: vendaItens.id_pacote, quantidade_sessoes: vendaItens.quantidade_sessoes })
                    .from(vendaItens)
                    .where(eq(vendaItens.id_venda, input.id))
                    .orderBy(vendaItens.id);
                const finais = await tx
                    .select({ parcela: financeiro.parcela, id_forma_pagamento: financeiro.id_forma_pagamento })
                    .from(financeiro)
                    .where(and(eq(financeiro.id_venda, input.id), sql`${financeiro.status} <> 'CANCELADO'`))
                    .orderBy(financeiro.parcela);
                const primeiro = itensFinais[0];
                await tx
                    .update(vendas)
                    .set({
                        id_pessoa: input.id_pessoa,
                        id_profissional: vendedor,
                        data_venda: dataVenda,
                        observacao: input.observacao || null,
                        valor: String(total / 100) as any,
                        quantidade_sessoes: itensFinais.reduce((t, i) => t + i.quantidade_sessoes, 0),
                        id_servico: primeiro?.id_servico ?? null,
                        id_pacote: primeiro?.id_servico ? null : primeiro?.id_pacote ?? null,
                        id_forma_pagamento: finais.find((f) => f.id_forma_pagamento)?.id_forma_pagamento ?? null,
                        quantidade_parcelas: new Set(finais.map((f) => f.parcela)).size || 1,
                        updated_at: new Date(),
                    })
                    .where(eq(vendas.id, input.id));
                await vincularPessoa(tx, input.id_pessoa, vendedor);
            });
            return { ok: true };
        }),

    /* ============= Atualizar observação ============= */
    updateObservacao: protectedProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                observacao: z.string().nullable(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await vendaGerenciavel(ctx.db, ctx.session, input.id);

            await ctx.db
                .update(vendas)
                .set({ observacao: input.observacao, updated_at: new Date() })
                .where(eq(vendas.id, input.id));
            return { ok: true };
        }),

    /* ============= Encerrar venda ============= */
    encerrar: protectedProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                motivo_encerramento: z.string().min(1, 'Informe o motivo do encerramento'),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const row = await vendaGerenciavel(ctx.db, ctx.session, input.id);
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
    delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await vendaGerenciavel(ctx.db, ctx.session, input.id);

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
                .where(or(eq(atendimentos.id_venda, input.id), sql`${atendimentos.id} IN ${atendimentosDaVenda(sql`${input.id}`)}`));
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
            // Validar acesso à venda (dono ou admin)
            await vendaGerenciavel(ctx.db, ctx.session, input.id_venda);

            return ctx.db
                .select({
                    id: financeiro.id,
                    parcela: financeiro.parcela,
                    valor: financeiro.valor,
                    data_vencimento: financeiro.data_vencimento,
                    data_pagamento: financeiro.data_pagamento,
                    status: financeiro.status,
                    id_forma_pagamento: financeiro.id_forma_pagamento,
                    forma_pagamento_nome: formasPagamento.nome,
                })
                .from(financeiro)
                .leftJoin(formasPagamento, eq(formasPagamento.id, financeiro.id_forma_pagamento))
                .where(eq(financeiro.id_venda, input.id_venda))
                .orderBy(financeiro.parcela, financeiro.data_vencimento);
        }),

    /* ============= Registrar pagamento ============= */
    registrarPagamento: protectedProcedure
        .input(
            z.object({
                id_financeiro: z.number().int().positive(),
                data_pagamento: z.union([z.string(), z.null()]), // string = registrar data; null = remover pagamento
                parcial: z.boolean().default(false),
                valor_pago: z.number().positive().optional(),
                novo_vencimento: z.string().optional(),
                /** Forma com que o cliente pagou (se diferente da combinada). */
                id_forma_pagamento: z.number().int().positive().optional(),
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
                    id_forma_pagamento: financeiro.id_forma_pagamento,
                })
                .from(financeiro)
                .where(eq(financeiro.id, input.id_financeiro))
                .limit(1);

            if (!parcela) throw new TRPCError({ code: 'NOT_FOUND', message: 'Parcela não encontrada' });
            if (parcela.status === 'CANCELADO') {
                throw new TRPCError({ code: 'CONFLICT', message: 'Parcela está cancelada' });
            }

            // Validar acesso via venda e obter data_venda para validação
            if (!parcela.id_venda) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parcela não pertence a uma venda' });
            const v = await vendaGerenciavel(ctx.db, ctx.session, parcela.id_venda);
            const dataVenda: Date | null = v.data_venda;

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
            if (input.id_forma_pagamento) {
                const [fp] = await ctx.db.select({ id: formasPagamento.id }).from(formasPagamento)
                    .where(and(eq(formasPagamento.id, input.id_forma_pagamento), eq(formasPagamento.ativo, true))).limit(1);
                if (!fp) throw new TRPCError({ code: 'NOT_FOUND', message: 'Forma de pagamento não encontrada' });
            }
            const forma = input.id_forma_pagamento && input.data_pagamento ? { id_forma_pagamento: input.id_forma_pagamento } : {};

            if (!input.parcial) {
                /* Pagamento integral ou remoção de pagamento */
                await ctx.db
                    .update(financeiro)
                    .set({
                        data_pagamento: input.data_pagamento === null ? null : dtPgto,
                        status: input.data_pagamento === null ? 'PENDENTE' : 'PAGO',
                        ...forma,
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
                        ...forma,
                    })
                    .where(eq(financeiro.id, input.id_financeiro));

                // Criar parcela com valor restante
                await tx.insert(financeiro).values({
                    id_venda: parcela.id_venda,
                    id_forma_pagamento: parcela.id_forma_pagamento,
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
            await vendaGerenciavel(ctx.db, ctx.session, input.id_venda);

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
                .where(or(eq(atendimentos.id_venda, input.id_venda), sql`${atendimentos.id} IN ${atendimentosDaVenda(sql`${input.id_venda}`)}`))
                .orderBy(atendimentos.data, atendimentos.hora_inicio);
        }),
});
