import { describe, expect, it } from 'vitest';
import { menorPreco, parseLista, slugify, montarInclui } from './protocolos';

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

describe('montarInclui', () => {
    const t = (id: number, nome: string) => ({ id, nome });
    it('técnicas primeiro, sem as ocultas nem repetidas, depois o digitado', () => {
        expect(montarInclui([t(1, 'Ventosaterapia'), t(2, 'Liberação miofascial'), t(1, 'Ventosaterapia')], [2], ['Chá de boas-vindas.']))
            .toEqual(['Ventosaterapia', 'Chá de boas-vindas.']);
    });
    it('não repete um texto digitado igual a uma técnica', () => {
        expect(montarInclui([t(1, 'Ventosaterapia')], [], ['ventosaterapia.', 'Outro'])).toEqual(['Ventosaterapia', 'Outro']);
    });
});
