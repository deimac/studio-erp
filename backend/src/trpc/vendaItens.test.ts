import { describe, expect, it } from 'vitest';
import { dividirParcelas } from './vendaItens';

describe('dividirParcelas', () => {
    it('divide igual quando fecha', () => {
        expect(dividirParcelas(300, 3)).toEqual([100, 100, 100]);
    });
    it('última parcela absorve os centavos e a soma fecha', () => {
        const p = dividirParcelas(670, 3);
        expect(p).toEqual([223.33, 223.33, 223.34]);
        expect(Math.round(p.reduce((a, b) => a + b, 0) * 100)).toBe(67000);
    });
    it('à vista é o valor inteiro', () => {
        expect(dividirParcelas(129.9, 1)).toEqual([129.9]);
    });
});
