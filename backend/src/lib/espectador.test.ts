import { describe, expect, it } from 'vitest';
import { podeEspectador } from './espectador';

describe('perfil espectador', () => {
    it('libera só as leituras da agenda e dos serviços', () => {
        for (const p of ['agenda.eventos', 'agenda.profissionais.list', 'agenda.salas.list', 'servicos.list', 'servicos.getById', 'usuarios.me']) {
            expect(podeEspectador(p, 'query')).toBe(true);
        }
    });

    it('barra o resto do sistema', () => {
        for (const p of ['vendas.list', 'financeiro.listWithDetails', 'pessoas.listClientes', 'agenda.lembretes', 'agenda.vendasDoCliente', 'agenda.disponibilidade']) {
            expect(podeEspectador(p, 'query')).toBe(false);
        }
    });

    it('nunca deixa alterar nada', () => {
        expect(podeEspectador('agenda.criar', 'mutation')).toBe(false);
        expect(podeEspectador('agenda.eventos', 'mutation')).toBe(false);
        expect(podeEspectador('servicos.update', 'mutation')).toBe(false);
    });
});
