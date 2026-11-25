import { describe, expect, it } from 'vitest';
import { calcularEconomia, formatBRL, formatDuracoes } from './format';
import { formatarTelefone, whatsappUrl } from './whatsapp';

const n = (s: string) => s.replace(/ /g, ' ');

describe('formatBRL', () => {
    it('formata número e string em reais', () => {
        expect(n(formatBRL(1040))).toBe('R$ 1.040,00');
        expect(n(formatBRL('150.00'))).toBe('R$ 150,00');
    });
});

describe('calcularEconomia', () => {
    it('retorna a economia do pacote frente às sessões avulsas', () => {
        expect(calcularEconomia(150, 4, 560)).toBe(40);
        expect(calcularEconomia(150, 8, 1040)).toBe(160);
    });
    it('retorna null quando não há economia', () => {
        expect(calcularEconomia(150, 4, 600)).toBeNull();
        expect(calcularEconomia(150, 4, 700)).toBeNull();
    });
});

describe('formatDuracoes', () => {
    it('mostra faixa ordenada sem repetição', () => {
        expect(formatDuracoes([90, 60, 60])).toBe('60 – 90 min');
        expect(formatDuracoes([80])).toBe('80 min');
        expect(formatDuracoes([])).toBe('');
    });
});

describe('whatsappUrl', () => {
    const contato = { numero: '+5543998468294', nome: 'Tayna' };
    it('usa o número e o nome configurados', () => {
        expect(whatsappUrl({}, contato)).toMatch(/^https:\/\/wa\.me\/5543998468294\?text=/);
        expect(decodeURIComponent(whatsappUrl({}, contato))).toContain('Olá, Tayna!');
    });
    it('sem nome nem número continua funcionando', () => {
        const url = whatsappUrl({}, {});
        expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
        expect(decodeURIComponent(url)).toContain('Olá! Gostaria');
    });
    it('descreve pacote, protocolo e modalidade', () => {
        expect(decodeURIComponent(whatsappUrl({ protocolo: 'Lipedema', modalidade: 'Pernas', pacote: { sessoes: 8 } }, contato)))
            .toContain('pacote de 8 sessões de Lipedema – Pernas');
    });
    it('pede vale-presente', () => {
        expect(decodeURIComponent(whatsappUrl({ protocolo: 'Ritual de Pausa', valePresente: true }, contato)))
            .toContain('vale-presente');
    });
});

describe('formatarTelefone', () => {
    it('formata celular brasileiro', () => expect(formatarTelefone('+5543998468294')).toBe('(43) 99846-8294'));
    it('formata fixo brasileiro', () => expect(formatarTelefone('+554332221111')).toBe('(43) 3222-1111'));
    it('deixa outros países como estão', () => expect(formatarTelefone('+14155550100')).toBe('+14155550100'));
});
