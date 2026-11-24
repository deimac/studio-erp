import { describe, expect, it } from 'vitest';
import { distribuirNovos } from './agenda';

describe('distribuirNovos', () => {
    it('avulso vende uma sessão por data', () => {
        expect(distribuirNovos([{ tipo: 'servico', sessoes: 1, valor: 150 }], 4)).toEqual([{ sessoes: 4, valor: 600, datas: [0, 1, 2, 3] }]);
    });
    it('pacote cobre as datas até acabar', () => {
        expect(distribuirNovos([{ tipo: 'pacote', sessoes: 8, valor: 1040 }], 4)[0]).toEqual({ sessoes: 8, valor: 1040, datas: [0, 1, 2, 3] });
        expect(distribuirNovos([{ tipo: 'pacote', sessoes: 2, valor: 280 }], 4)[0].datas).toEqual([0, 1]);
    });
    it('sem cadastro cobrado em data única', () => {
        expect(distribuirNovos([{ tipo: 'livre', sessoes: 1, valor: 50 }], 1)).toEqual([{ sessoes: 1, valor: 50, datas: [0] }]);
    });
});
