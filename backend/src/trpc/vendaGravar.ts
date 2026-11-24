import { financeiro, vendaItens, vendas } from '../drizzle/schema';
import { vincularPessoa, type DbOuTx } from './acesso';
import { dividirParcelas } from './vendaItens';

/** Item já validado: serviço, pacote ou descrição livre. */
export type ItemGravar = { id_servico?: number | null; id_pacote?: number | null; descricao?: string | null; quantidade_sessoes: number; valor: number };
export type PagamentoGravar = { id_forma_pagamento: number; valor: number; parcelas: number; primeiro_vencimento: Date; pago: boolean };

/**
 * Grava venda, itens e parcelas (deve rodar dentro de uma transação).
 * As validações (acesso, serviços, total = pagamentos) ficam com quem chama.
 */
export async function gravarVenda(
    tx: DbOuTx,
    v: { unidadeId: number; id_pessoa: number; vendedor: number; data_venda: Date; observacao?: string | null; itens: ItemGravar[]; pagamentos: PagamentoGravar[] },
): Promise<number> {
    const primeiro = v.itens[0];
    const total = v.itens.reduce((t, i) => t + Math.round(i.valor * 100), 0) / 100;
    const ids = await tx
        .insert(vendas)
        .values({
            id_pessoa: v.id_pessoa,
            // Resumo (compatibilidade): 1º item, total de sessões, 1ª forma
            id_servico: primeiro.id_servico ?? null,
            id_pacote: primeiro.id_servico ? null : primeiro.id_pacote ?? null,
            id_forma_pagamento: v.pagamentos[0].id_forma_pagamento,
            id_unidade: v.unidadeId,
            quantidade_sessoes: v.itens.reduce((t, i) => t + i.quantidade_sessoes, 0),
            valor: String(total) as any,
            data_venda: v.data_venda,
            quantidade_parcelas: v.pagamentos.reduce((t, p) => t + p.parcelas, 0),
            observacao: v.observacao || null,
            status: 'ATIVA',
            id_profissional: v.vendedor,
        })
        .$returningId();
    const vendaId = ids[0]!.id;
    await vincularPessoa(tx, v.id_pessoa, v.vendedor);

    for (const it of v.itens) {
        await tx.insert(vendaItens).values({
            id_venda: vendaId,
            id_servico: it.id_servico ?? null,
            id_pacote: it.id_pacote ?? null,
            descricao: it.descricao ?? null,
            quantidade_sessoes: it.quantidade_sessoes,
            valor: String(it.valor) as any,
        });
    }

    // Parcelas numeradas em sequência, cada uma com a sua forma
    let numero = 0;
    for (const p of v.pagamentos) {
        const valores = dividirParcelas(p.valor, p.parcelas);
        for (let i = 0; i < p.parcelas; i++) {
            numero += 1;
            const vencimento = new Date(p.primeiro_vencimento);
            vencimento.setMonth(vencimento.getMonth() + i);
            await tx.insert(financeiro).values({
                id_venda: vendaId,
                id_forma_pagamento: p.id_forma_pagamento,
                parcela: numero,
                valor: String(valores[i]) as any,
                data_lancamento: v.data_venda,
                data_vencimento: vencimento,
                data_pagamento: p.pago ? v.data_venda : null,
                status: p.pago ? 'PAGO' : 'PENDENTE',
            });
        }
    }
    return vendaId;
}
