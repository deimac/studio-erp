/**
 * Datas "só dia" (sem hora) chegam do servidor como meia-noite UTC
 * ("2026-11-23T00:00:00.000Z"). Formatar com o fuso do navegador (-03) mostra o
 * dia anterior; por isso usamos só a parte AAAA-MM-DD.
 */
export function diaISO(v: string | Date | null | undefined): string | null {
    if (!v) return null;
    const s = v instanceof Date ? v.toISOString() : String(v);
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    return m ? m[1] : null;
}

/** "2026-11-23" → "23/11/2026"; vazio → "". */
export function dataBR(v: string | Date | null | undefined): string {
    const d = diaISO(v);
    if (!d) return '';
    const [a, m, dia] = d.split('-');
    return `${dia}/${m}/${a}`;
}
