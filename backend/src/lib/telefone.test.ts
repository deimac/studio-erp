import { describe, expect, it } from 'vitest';
import { normalizarTelefone, telefoneWhatsApp } from './telefone';
import { linkWhatsApp } from './agenda';

describe('normalizarTelefone', () => {
    it('brasileiro só com dígitos vira +55', () => {
        expect(normalizarTelefone('(11) 99999-0000')).toBe('+5511999990000');
        expect(normalizarTelefone('1133334444')).toBe('+551133334444');
    });
    it('mantém outros países', () => {
        expect(normalizarTelefone('+351 912 345 678')).toBe('+351912345678');
        expect(normalizarTelefone('+1 415 555 2671')).toBe('+14155552671');
    });
    it('aceita 55 sem o +', () => {
        expect(normalizarTelefone('5511999990000')).toBe('+5511999990000');
    });
    it('vazio e inválido', () => {
        expect(normalizarTelefone('')).toBeNull();
        expect(normalizarTelefone('123')).toBeUndefined();
    });
});

describe('WhatsApp', () => {
    it('usa o número internacional', () => {
        expect(telefoneWhatsApp('+351912345678')).toBe('351912345678');
        expect(linkWhatsApp('+5511999990000', 'oi')).toBe('https://wa.me/5511999990000?text=oi');
        expect(linkWhatsApp('11999990000', 'oi')).toBe('https://wa.me/5511999990000?text=oi');
    });
});
