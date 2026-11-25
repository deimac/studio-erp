/**
 * Posição dos atendimentos dentro da coluna do dia (react-big-calendar `dayLayoutAlgorithm`).
 *
 * Atendimentos que se cruzam no horário formam um grupo; o grupo é dividido em colunas
 * de MESMA largura (o padrão da biblioteca esticava o último e deixava um grande e outro pequeno).
 */
type Args<E> = {
    events: E[];
    slotMetrics: { getRange: (start: Date, end: Date) => { top: number; height: number; startDate: Date; endDate: Date } };
    accessors: { start: (e: E) => Date; end: (e: E) => Date };
};

const GAP_PX = 2;

export function layoutIgual<E>({ events, slotMetrics, accessors }: Args<E>) {
    const itens = events
        .map((event) => {
            const r = slotMetrics.getRange(accessors.start(event), accessors.end(event));
            return { event, top: r.top, height: r.height, ini: +r.startDate, fim: +r.endDate, col: 0, grupo: 0 };
        })
        .sort((a, b) => a.ini - b.ini || b.fim - a.fim);

    // grupos de atendimentos encadeados no horário
    const colunasDoGrupo: number[] = [];
    let grupo = -1;
    let fimGrupo = -Infinity;
    let colunas: number[] = []; // fim do último item de cada coluna do grupo atual
    for (const it of itens) {
        if (it.ini >= fimGrupo) {
            grupo++;
            colunas = [];
            colunasDoGrupo[grupo] = 0;
        }
        let c = colunas.findIndex((fim) => fim <= it.ini);
        if (c === -1) {
            c = colunas.length;
            colunas.push(it.fim);
        } else colunas[c] = it.fim;
        it.col = c;
        it.grupo = grupo;
        colunasDoGrupo[grupo] = Math.max(colunasDoGrupo[grupo]!, colunas.length);
        fimGrupo = Math.max(fimGrupo, it.fim);
    }

    return itens.map((it) => {
        const n = colunasDoGrupo[it.grupo]!;
        const largura = 100 / n;
        const gap = n > 1 ? GAP_PX : 0;
        return {
            event: it.event,
            style: {
                top: it.top,
                height: `calc(${it.height}% - 2px)`,
                width: `calc(${largura}% - ${gap}px)`,
                xOffset: `calc(${it.col * largura}% + ${it.col > 0 ? gap / 2 : 0}px)`,
            },
        };
    });
}
