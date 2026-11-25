/**
 * Feriados mostrados na agenda (só aviso, não bloqueiam nada).
 * Nacionais são calculados aqui; os da cidade/estado vêm da tabela `feriados`.
 */

export type TipoFeriado = 'NACIONAL' | 'FACULTATIVO' | 'LOCAL';
export type Feriado = { data: string; nome: string; tipo: TipoFeriado };
/** Cadastrado pela clínica: ano null = repete todo ano. */
export type FeriadoCadastrado = { dia: number; mes: number; ano: number | null; nome: string };

const FIXOS: [number, number, string][] = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência do Brasil'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [11, 20, 'Dia da Consciência Negra'],
    [12, 25, 'Natal'],
];

const iso = (ano: number, mes: number, dia: number) =>
    `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(ano, mes, dia);
}

function somar(dataIso: string, dias: number): string {
    const [a, m, d] = dataIso.split('-').map(Number);
    const dt = new Date(Date.UTC(a!, m! - 1, d! + dias));
    return dt.toISOString().slice(0, 10);
}

export function feriadosNacionais(ano: number): Feriado[] {
    const p = pascoa(ano);
    return [
        ...FIXOS.map(([mes, dia, nome]) => ({ data: iso(ano, mes, dia), nome, tipo: 'NACIONAL' as const })),
        { data: somar(p, -48), nome: 'Carnaval', tipo: 'FACULTATIVO' as const },
        { data: somar(p, -47), nome: 'Carnaval', tipo: 'FACULTATIVO' as const },
        { data: somar(p, -2), nome: 'Sexta-feira Santa', tipo: 'NACIONAL' as const },
        { data: somar(p, 60), nome: 'Corpus Christi', tipo: 'FACULTATIVO' as const },
    ];
}

/** Todos os feriados entre `de` e `ate` (YYYY-MM-DD), em ordem de data. */
export function feriadosNoPeriodo(de: string, ate: string, cadastrados: FeriadoCadastrado[] = []): Feriado[] {
    const anoIni = Number(de.slice(0, 4));
    const anoFim = Number(ate.slice(0, 4));
    const lista: Feriado[] = [];
    for (let ano = anoIni; ano <= anoFim; ano++) {
        lista.push(...feriadosNacionais(ano));
        for (const c of cadastrados) {
            if (c.ano != null && c.ano !== ano) continue;
            lista.push({ data: iso(ano, c.mes, c.dia), nome: c.nome, tipo: 'LOCAL' });
        }
    }
    return lista.filter((f) => f.data >= de && f.data <= ate).sort((a, b) => a.data.localeCompare(b.data));
}
