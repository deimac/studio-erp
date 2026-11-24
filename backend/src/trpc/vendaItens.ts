import { sql, type SQL, type AnyColumn } from 'drizzle-orm';

/**
 * Venda com vários itens (serviços avulsos e pacotes) e várias formas de pagamento.
 * Trechos SQL reaproveitados pelas listagens (vendas, financeiro, agenda, atendimentos).
 */

const nomeItem = sql.raw(`COALESCE(px.nome, sx.nome, vix.descricao)`);

/** "Pacote Pernas 8 sessões + Drenagem" — nomes dos itens da venda. */
export function rotuloVenda(idVenda: AnyColumn | SQL): SQL<string | null> {
    return sql<string | null>`(SELECT GROUP_CONCAT(${nomeItem} ORDER BY vix.id SEPARATOR ' + ')
        FROM venda_itens vix
        LEFT JOIN pacotes px ON px.id = vix.id_pacote
        LEFT JOIN servicos sx ON sx.id = vix.id_servico
        WHERE vix.id_venda = ${idVenda})`;
}

/** Algum item da venda é pacote? */
export function vendaTemPacote(idVenda: AnyColumn | SQL): SQL<number> {
    return sql<number>`EXISTS(SELECT 1 FROM venda_itens vix WHERE vix.id_venda = ${idVenda} AND vix.id_pacote IS NOT NULL)`;
}

/** "Pix + Cartão" — formas de pagamento usadas nas parcelas da venda. */
export function formasDaVenda(idVenda: AnyColumn | SQL): SQL<string | null> {
    return sql<string | null>`(SELECT GROUP_CONCAT(DISTINCT fpx.nome ORDER BY fpx.nome SEPARATOR ' + ')
        FROM financeiro fx JOIN formas_pagamento fpx ON fpx.id = fx.id_forma_pagamento
        WHERE fx.id_venda = ${idVenda} AND fx.status <> 'CANCELADO')`;
}

/** Nome do item da venda (pacote ou serviço). */
export function rotuloItem(idItem: AnyColumn | SQL): SQL<string | null> {
    return sql<string | null>`(SELECT ${nomeItem}
        FROM venda_itens vix
        LEFT JOIN pacotes px ON px.id = vix.id_pacote
        LEFT JOIN servicos sx ON sx.id = vix.id_servico
        WHERE vix.id = ${idItem})`;
}

/** Sessões do item já comprometidas (agendadas, confirmadas, realizadas ou faltas descontadas). */
export function usadasDoItem(idItem: AnyColumn | SQL): SQL<number> {
    return sql<number>`(SELECT COUNT(*) FROM atendimentos ax WHERE ax.id_venda_item = ${idItem} AND ${CONSOME_SESSAO})`;
}

/**
 * Atendimento que consome a sessão do item: agendado, confirmado, realizado
 * ou falta que, pela regra, desconta a sessão. Use com o alias `ax`.
 */
export const CONSOME_SESSAO = sql.raw(`(ax.status IN ('AGENDADO','CONFIRMADO','REALIZADO') OR (ax.status = 'FALTOU' AND ax.falta_consome = 1))`);

/** Divide um valor em N parcelas; a última absorve os centavos. */
export function dividirParcelas(valor: number, n: number): number[] {
    const base = Math.floor((valor / n) * 100) / 100;
    const lista = Array.from({ length: n }, () => base);
    lista[n - 1] = Math.round((valor - base * (n - 1)) * 100) / 100;
    return lista;
}
