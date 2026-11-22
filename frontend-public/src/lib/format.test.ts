import { describe, expect, it } from 'vitest';
import { calcularEconomia, formatBRL, formatDuracoes } from './format';
import { whatsappUrl } from './whatsapp';

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
    it('usa o número da Tayna', () => {
        expect(whatsappUrl({})).toMatch(/^https:\/\/wa\.me\/5543998468294\?text=/);
    });
    it('descreve pacote, protocolo e modalidade', () => {
        expect(decodeURIComponent(whatsappUrl({ protocolo: 'Lipedema', modalidade: 'Pernas', pacote: { sessoes: 8 } })))
            .toContain('pacote de 8 sessões de Lipedema – Pernas');
    });
    it('pede vale-presente', () => {
        expect(decodeURIComponent(whatsappUrl({ protocolo: 'Ritual de Pausa', valePresente: true })))
            .toContain('vale-presente');
    });
});
