import { describe, expect, it } from 'vitest';
import { menorPreco, parseLista, slugify, montarLista } from './protocolos';

describe('slugify', () => {
    it('remove acentos e espaços', () => {
        expect(slugify('Método TS')).toBe('metodo-ts');
        expect(slugify('  Alívio Terapêutico ')).toBe('alivio-terapeutico');
    });
});

describe('parseLista', () => {
    it('aceita string JSON e array', () => {
        expect(parseLista('["a","b"]')).toEqual(['a', 'b']);
        expect(parseLista(['a'])).toEqual(['a']);
    });
    it('retorna vazio para nulo ou JSON inválido', () => {
        expect(parseLista(null)).toEqual([]);
        expect(parseLista('não é json')).toEqual([]);
    });
    it('mantém só strings não vazias', () => {
        expect(parseLista('[1,"x",""]')).toEqual(['x']);
    });
});

describe('menorPreco', () => {
    it('retorna o menor valor', () => {
        expect(menorPreco([{ valor: '200.00' }, { valor: '150.00' }])).toBe(150);
    });
    it('retorna null sem serviços', () => {
        expect(menorPreco([])).toBeNull();
    });
});

describe('montarLista', () => {
    const t = (id: number, nome: string) => ({ id, nome });
    it('na ordem, sem os ocultos e sem repetir', () => {
        expect(montarLista([t(1, 'Ventosaterapia'), t(2, 'Liberação miofascial'), t(1, 'Ventosaterapia'), t(3, 'Aromaterapia')], [2]))
            .toEqual(['Ventosaterapia', 'Aromaterapia']);
    });
});
