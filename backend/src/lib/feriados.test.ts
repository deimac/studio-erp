import { describe, expect, it } from 'vitest';
import { feriadosNacionais, feriadosNoPeriodo, pascoa } from './feriados';

describe('feriados', () => {
    it('calcula a Páscoa', () => {
        expect(pascoa(2025)).toBe('2025-04-20');
        expect(pascoa(2026)).toBe('2026-04-05');
        expect(pascoa(2027)).toBe('2027-03-28');
    });

    it('feriados móveis de 2026', () => {
        const f = feriadosNacionais(2026);
        const data = (nome: string) => f.filter((x) => x.nome === nome).map((x) => x.data);
        expect(data('Carnaval')).toEqual(['2026-02-16', '2026-02-17']);
        expect(data('Sexta-feira Santa')).toEqual(['2026-04-03']);
        expect(data('Corpus Christi')).toEqual(['2026-06-04']);
    });

    it('junta os da cidade, repete todo ano e respeita o período', () => {
        const l = feriadosNoPeriodo('2026-12-20', '2027-05-15', [
            { dia: 10, mes: 5, ano: null, nome: 'Aniversário de Maringá' },
            { dia: 24, mes: 12, ano: 2026, nome: 'Ponte de Natal' },
            { dia: 24, mes: 12, ano: 2025, nome: 'Outro ano' },
        ]);
        expect(l.map((x) => `${x.data} ${x.nome}`)).toEqual([
            '2026-12-24 Ponte de Natal',
            '2026-12-25 Natal',
            '2027-01-01 Confraternização Universal',
            '2027-02-08 Carnaval',
            '2027-02-09 Carnaval',
            '2027-03-26 Sexta-feira Santa',
            '2027-04-21 Tiradentes',
            '2027-05-01 Dia do Trabalho',
            '2027-05-10 Aniversário de Maringá',
        ]);
        expect(l.find((x) => x.nome === 'Aniversário de Maringá')?.tipo).toBe('LOCAL');
    });
});
