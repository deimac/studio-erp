import { describe, expect, it } from 'vitest';
import { podeEditarServico, podeVerServico, servicoServeParaProfissional } from './servicosAcesso';

const admin = { id: 1, perfil: 'ADMIN' as const };
const ana = { id: 2, perfil: 'PROFISSIONAL' as const, veServicosClinica: false };
const anaComClinica = { ...ana, veServicosClinica: true };

describe('acesso a serviços', () => {
    it('serviço da clínica: só quem o admin liberou vê; só admin edita', () => {
        expect(podeVerServico(null, ana)).toBe(false);
        expect(podeVerServico(null, anaComClinica)).toBe(true);
        expect(podeVerServico(null, admin)).toBe(true);
        expect(podeEditarServico(null, anaComClinica)).toBe(false);
        expect(podeEditarServico(null, admin)).toBe(true);
    });
    it('serviço próprio: dono e admin veem e editam; colega não', () => {
        expect(podeVerServico(2, ana)).toBe(true);
        expect(podeEditarServico(2, ana)).toBe(true);
        expect(podeVerServico(3, anaComClinica)).toBe(false);
        expect(podeEditarServico(3, ana)).toBe(false);
        expect(podeVerServico(3, admin)).toBe(true);
        expect(podeEditarServico(3, admin)).toBe(true);
    });
    it('no agendamento/venda: próprio só para o dono; da clínica só se liberado', () => {
        expect(servicoServeParaProfissional(null, 2, true)).toBe(true);
        expect(servicoServeParaProfissional(null, 2, false)).toBe(false);
        expect(servicoServeParaProfissional(2, 2, false)).toBe(true);
        expect(servicoServeParaProfissional(3, 2, true)).toBe(false);
    });
});
