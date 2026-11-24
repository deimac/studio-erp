import { describe, expect, it } from 'vitest';
import { filtroDono, incluiSemDono, podeGerenciar } from './escopo';

const admin = { id: 1, perfil: 'ADMIN' as const, veTudo: true };
const adminIndividual = { id: 1, perfil: 'ADMIN' as const, veTudo: false };
const ana = { id: 2, perfil: 'PROFISSIONAL' as const, veTudo: false };

describe('escopo por profissional', () => {
    it('profissional sempre filtra pelo próprio id, mesmo pedindo GERAL', () => {
        expect(filtroDono(ana)).toBe(2);
        expect(filtroDono(ana, 'GERAL')).toBe(2);
        expect(incluiSemDono(ana)).toBe(false);
    });
    it('admin no modo Clínica: GERAL sem filtro, MEU filtra pelo próprio id', () => {
        expect(filtroDono(admin)).toBeNull();
        expect(filtroDono(admin, 'GERAL')).toBeNull();
        expect(filtroDono(admin, 'MEU')).toBe(1);
        expect(incluiSemDono(admin)).toBe(false);
    });
    it('admin no modo "cada um cuida do seu": sempre o dele + os sem dono', () => {
        expect(filtroDono(adminIndividual)).toBe(1);
        expect(filtroDono(adminIndividual, 'GERAL')).toBe(1);
        expect(incluiSemDono(adminIndividual)).toBe(true);
    });
    it('gerenciar: admin Clínica tudo; profissional só o dele; sem dono só admin', () => {
        expect(podeGerenciar(3, admin)).toBe(true);
        expect(podeGerenciar(null, admin)).toBe(true);
        expect(podeGerenciar(2, ana)).toBe(true);
        expect(podeGerenciar(3, ana)).toBe(false);
        expect(podeGerenciar(null, ana)).toBe(false);
    });
    it('gerenciar: admin no modo "cada um cuida do seu" não mexe no da colega', () => {
        expect(podeGerenciar(1, adminIndividual)).toBe(true);
        expect(podeGerenciar(null, adminIndividual)).toBe(true);
        expect(podeGerenciar(2, adminIndividual)).toBe(false);
    });
});
