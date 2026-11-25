/** Gera slug de URL a partir de um nome ("Método TS" → "metodo-ts"). */
export function slugify(nome: string): string {
    return nome
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Converte valor do banco (JSON string ou array) em lista de strings não vazias. */
export function parseLista(valor: unknown): string[] {
    let lista: unknown = valor;
    if (typeof valor === 'string') {
        try {
            lista = JSON.parse(valor);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(lista)) return [];
    return lista.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/** Menor preço entre os serviços (modalidades) ou null se não houver. */
export function menorPreco(servicos: Array<{ valor: string | number }>): number | null {
    const valores = servicos.map((s) => Number(s.valor)).filter((v) => Number.isFinite(v));
    return valores.length ? Math.min(...valores) : null;
}

/** Lista de ids (JSON) do banco; inválido vira []. */
export function parseIds(valor: unknown): number[] {
    let lista: unknown = valor;
    if (typeof valor === 'string') {
        try {
            lista = JSON.parse(valor);
        } catch {
            return [];
        }
    }
    return Array.isArray(lista) ? lista.filter((v): v is number => Number.isInteger(v)) : [];
}

/**
 * Lista do site ("Técnicas aplicadas" ou "Benefícios"): itens marcados nos serviços
 * da página, na ordem dos serviços, sem os que a página escondeu e sem repetir.
 */
export function montarLista(itensDosServicos: Array<{ id: number; nome: string }>, ocultos: number[]): string[] {
    const vistos = new Set<string>();
    const lista: string[] = [];
    for (const t of itensDosServicos) {
        const chave = t.nome.trim().toLowerCase();
        if (ocultos.includes(t.id) || !chave || vistos.has(chave)) continue;
        vistos.add(chave);
        lista.push(t.nome.trim());
    }
    return lista;
}
