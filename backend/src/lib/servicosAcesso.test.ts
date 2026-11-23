import { describe, expect, it } from 'vitest';
import { podeEditarServico, podeVerServico, servicoServeParaProfissional } from './servicosAcesso';

const admin = { id: 1, perfil: 'ADMIN' as const };
const ana = { id: 2, perfil: 'PROFISSIONAL' as const };

describe('acesso a serviços', () => {
    it('serviço da clínica: todos veem, só admin edita', () => {
        expect(podeVerServico(null, ana)).toBe(true);
        expect(podeEditarServico(null, ana)).toBe(false);
        expect(podeEditarServico(null, admin)).toBe(true);
    });
    it('serviço próprio: dono e admin veem e editam; colega não', () => {
        expect(podeVerServico(2, ana)).toBe(true);
        expect(podeEditarServico(2, ana)).toBe(true);
        expect(podeVerServico(3, ana)).toBe(false);
        expect(podeEditarServico(3, ana)).toBe(false);
        expect(podeVerServico(3, admin)).toBe(true);
        expect(podeEditarServico(3, admin)).toBe(true);
    });
    it('no agendamento, serviço próprio só serve para o dono', () => {
        expect(servicoServeParaProfissional(null, 2)).toBe(true);
        expect(servicoServeParaProfissional(2, 2)).toBe(true);
        expect(servicoServeParaProfissional(3, 2)).toBe(false);
    });
});
