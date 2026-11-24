import { describe, expect, it } from 'vitest';
import { faltaConsome, regraFaltaEfetiva } from './agenda';

describe('regraFaltaEfetiva', () => {
    it('regra da clínica vale para todos', () => {
        expect(regraFaltaEfetiva({ falta_regra: 'DESCONTAR', falta_por_profissional: false }, { falta_regra: 'DEVOLVER' })).toBe('DESCONTAR');
    });
    it('cada profissional define a sua', () => {
        expect(regraFaltaEfetiva({ falta_regra: 'DESCONTAR', falta_por_profissional: true }, { falta_regra: 'DEVOLVER' })).toBe('DEVOLVER');
    });
    it('profissional sem regra segue a clínica', () => {
        expect(regraFaltaEfetiva({ falta_regra: 'PERGUNTAR', falta_por_profissional: true }, { falta_regra: null })).toBe('PERGUNTAR');
    });
});

describe('faltaConsome', () => {
    it('descontar e devolver ignoram a resposta', () => {
        expect(faltaConsome('DESCONTAR', false)).toBe(true);
        expect(faltaConsome('DEVOLVER', true)).toBe(false);
    });
    it('perguntar usa a resposta e exige uma', () => {
        expect(faltaConsome('PERGUNTAR', true)).toBe(true);
        expect(faltaConsome('PERGUNTAR', false)).toBe(false);
        expect(faltaConsome('PERGUNTAR', undefined)).toBeNull();
    });
});
