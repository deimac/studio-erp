import { describe, expect, it } from 'vitest';
import { filtroDono, podeGerenciar } from './escopo';

const admin = { id: 1, perfil: 'ADMIN' as const };
const ana = { id: 2, perfil: 'PROFISSIONAL' as const };

describe('escopo por profissional', () => {
    it('profissional sempre filtra pelo próprio id, mesmo pedindo GERAL', () => {
        expect(filtroDono(ana)).toBe(2);
        expect(filtroDono(ana, 'GERAL')).toBe(2);
    });
    it('admin: GERAL sem filtro, MEU filtra pelo próprio id', () => {
        expect(filtroDono(admin)).toBeNull();
        expect(filtroDono(admin, 'GERAL')).toBeNull();
        expect(filtroDono(admin, 'MEU')).toBe(1);
    });
    it('gerenciar: admin tudo; profissional só o dele; sem dono só admin', () => {
        expect(podeGerenciar(3, admin)).toBe(true);
        expect(podeGerenciar(null, admin)).toBe(true);
        expect(podeGerenciar(2, ana)).toBe(true);
        expect(podeGerenciar(3, ana)).toBe(false);
        expect(podeGerenciar(null, ana)).toBe(false);
    });
});
