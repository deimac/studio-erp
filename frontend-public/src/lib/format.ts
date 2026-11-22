const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(v: number | string): string {
    return brl.format(Number(v));
}

/** Economia do pacote frente a `sessoes` avulsas; null quando não há economia. */
export function calcularEconomia(valorAvulso: number, sessoes: number, valorPacote: number): number | null {
    const economia = Math.round((valorAvulso * sessoes - valorPacote) * 100) / 100;
    return economia > 0 ? economia : null;
}

export function formatDuracoes(min: number[]): string {
    const u = [...new Set(min)].sort((a, b) => a - b);
    if (!u.length) return '';
    return u.length === 1 ? `${u[0]} min` : `${u[0]} – ${u[u.length - 1]} min`;
}
