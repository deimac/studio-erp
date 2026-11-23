import { describe, expect, it } from 'vitest';
import {
    bloqueioNoDia,
    calcularFim,
    conflitosImpeditivos,
    diaSemana,
    gerarOcorrencias,
    hhmmParaMin,
    horariosLivres,
    intervalosSobrepoem,
    linkWhatsApp,
    mensagemWhatsApp,
    minParaHHMM,
    verificarConflitos,
    type HorarioTrabalho,
    type Ocupacao,
} from './agenda';

const SEG = '2026-11-23'; // segunda-feira
const h = (v: string) => hhmmParaMin(v);

const expedienteSeg: HorarioTrabalho[] = [
    { dia_semana: 1, inicio: h('08:00'), fim: h('12:00') },
    { dia_semana: 1, inicio: h('14:00'), fim: h('18:00') },
];

function ocup(p: Partial<Ocupacao>): Ocupacao {
    return { id: 1, data: SEG, inicio: h('09:00'), fim: h('10:00'), id_profissional: 1, id_sala: 1, status: 'AGENDADO', ...p };
}

describe('horários', () => {
    it('converte HH:MM e HH:MM:SS', () => {
        expect(hhmmParaMin('09:30')).toBe(570);
        expect(hhmmParaMin('09:30:00')).toBe(570);
        expect(minParaHHMM(570)).toBe('09:30');
    });
    it('dia da semana', () => {
        expect(diaSemana(SEG)).toBe(1);
        expect(diaSemana('2026-11-22')).toBe(0);
    });
});

describe('intervalosSobrepoem', () => {
    it('encostar não conflita', () => {
        expect(intervalosSobrepoem({ inicio: 540, fim: 600 }, { inicio: 600, fim: 660 })).toBe(false);
    });
    it('sobreposição parcial conflita', () => {
        expect(intervalosSobrepoem({ inicio: 540, fim: 600 }, { inicio: 570, fim: 630 })).toBe(true);
    });
});

describe('verificarConflitos', () => {
    const base = { data: SEG, inicio: h('09:30'), fim: h('10:30'), id_profissional: 1, id_sala: 2 };

    it('sem conflitos dentro do expediente', () => {
        expect(verificarConflitos({ novo: { ...base, inicio: h('10:00'), fim: h('11:00') }, existentes: [ocup({})], bloqueios: [], horarios: expedienteSeg })).toEqual([]);
    });

    it('mesmo profissional ocupado', () => {
        const c = verificarConflitos({ novo: base, existentes: [ocup({ id_sala: 9 })], bloqueios: [], horarios: expedienteSeg });
        expect(c.map((x) => x.tipo)).toEqual(['PROFISSIONAL_OCUPADO']);
    });

    it('mesma sala com outro profissional', () => {
        const c = verificarConflitos({ novo: base, existentes: [ocup({ id_profissional: 2, id_sala: 2 })], bloqueios: [], horarios: expedienteSeg });
        expect(c.map((x) => x.tipo)).toEqual(['SALA_OCUPADA']);
    });

    it('agenda compartilhada: colega do grupo ocupa o horário', () => {
        const c = verificarConflitos({ novo: { ...base, id_sala: null }, existentes: [ocup({ id_profissional: 2, id_sala: null })], bloqueios: [], horarios: expedienteSeg, compartilhados: [1, 2] });
        expect(c.map((x) => x.tipo)).toEqual(['AGENDA_COMPARTILHADA']);
    });

    it('agenda compartilhada: quem está fora do grupo não bloqueia nem é bloqueado', () => {
        const existentes = [ocup({ id_profissional: 3, id_sala: null })];
        expect(verificarConflitos({ novo: { ...base, id_sala: null }, existentes, bloqueios: [], horarios: expedienteSeg, compartilhados: [1, 2] })).toEqual([]);
        expect(verificarConflitos({ novo: { ...base, id_sala: null, id_profissional: 3 }, existentes: [ocup({ id_profissional: 1, id_sala: null })], bloqueios: [], horarios: [{ dia_semana: 1, inicio: 0, fim: 1440 }], compartilhados: [1, 2] })).toEqual([]);
    });

    it('sem sala não conflita com sala de outro profissional', () => {
        const c = verificarConflitos({ novo: { ...base, id_sala: null }, existentes: [ocup({ id_profissional: 2 })], bloqueios: [], horarios: expedienteSeg });
        expect(c).toEqual([]);
    });

    it('cancelados e faltas não ocupam', () => {
        const existentes = [ocup({ status: 'CANCELADO' }), ocup({ id: 2, status: 'FALTOU' })];
        expect(verificarConflitos({ novo: base, existentes, bloqueios: [], horarios: expedienteSeg })).toEqual([]);
    });

    it('ignora o próprio atendimento ao editar', () => {
        expect(verificarConflitos({ novo: { ...base, ignorarId: 1 }, existentes: [ocup({})], bloqueios: [], horarios: expedienteSeg })).toEqual([]);
    });

    it('bloqueio da clínica inteira e do profissional', () => {
        const bloqueios = [
            { id: 1, id_profissional: null, id_sala: null, inicio: `${SEG} 10:00:00`, fim: `${SEG} 11:00:00`, motivo: 'Reunião' },
            { id: 2, id_profissional: 7, id_sala: null, inicio: `${SEG} 08:00:00`, fim: `${SEG} 18:00:00` },
        ];
        const c = verificarConflitos({ novo: base, existentes: [], bloqueios, horarios: expedienteSeg });
        expect(c).toEqual([{ tipo: 'BLOQUEIO', id: 1, mensagem: 'Horário bloqueado: Reunião' }]);
    });

    it('bloqueio de vários dias (férias) cobre o dia inteiro do meio', () => {
        expect(bloqueioNoDia({ inicio: '2026-11-20 13:00', fim: '2026-11-25 12:00' }, SEG)).toEqual({ inicio: 0, fim: 1440 });
        expect(bloqueioNoDia({ inicio: '2026-11-20 13:00', fim: '2026-11-22 12:00' }, SEG)).toBeNull();
    });

    it('fora do expediente: bloqueia profissional, admin pode forçar', () => {
        const c = verificarConflitos({ novo: { ...base, inicio: h('12:00'), fim: h('13:00') }, existentes: [], bloqueios: [], horarios: expedienteSeg });
        expect(c.map((x) => x.tipo)).toEqual(['FORA_DO_EXPEDIENTE']);
        expect(conflitosImpeditivos(c, { isAdmin: false, forcar: true })).toHaveLength(1);
        expect(conflitosImpeditivos(c, { isAdmin: true, forcar: true })).toHaveLength(0);
        expect(conflitosImpeditivos(c, { isAdmin: true })).toHaveLength(1);
    });

    it('atendimento atravessando o almoço está fora do expediente', () => {
        const c = verificarConflitos({ novo: { ...base, inicio: h('11:30'), fim: h('14:30') }, existentes: [], bloqueios: [], horarios: expedienteSeg });
        expect(c.map((x) => x.tipo)).toEqual(['FORA_DO_EXPEDIENTE']);
    });
});

describe('cálculos', () => {
    it('fim soma durações de vários serviços', () => {
        expect(calcularFim(h('09:00'), [60, 30])).toBe(h('10:30'));
    });

    it('recorrência semanal e quinzenal', () => {
        expect(gerarOcorrencias(SEG, 3)).toEqual(['2026-11-23', '2026-11-30', '2026-12-07']);
        expect(gerarOcorrencias(SEG, 2, 2)).toEqual(['2026-11-23', '2026-12-07']);
    });

    it('horários livres respeitam expediente e ocupação', () => {
        const livres = horariosLivres({
            data: SEG,
            duracao: 60,
            passo: 60,
            id_profissional: 1,
            id_sala: null,
            horarios: expedienteSeg,
            existentes: [ocup({})],
            bloqueios: [],
        });
        expect(livres).toEqual(['08:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    });

    it('horários livres consideram colegas da agenda compartilhada', () => {
        const livres = horariosLivres({
            data: SEG, duracao: 60, passo: 60, id_profissional: 1, id_sala: null, horarios: expedienteSeg,
            existentes: [ocup({ id_profissional: 2, inicio: h('14:00'), fim: h('15:00') })], bloqueios: [], compartilhados: [1, 2],
        });
        expect(livres).toEqual(['08:00', '09:00', '10:00', '11:00', '15:00', '16:00', '17:00']);
    });
});

describe('WhatsApp', () => {
    it('gera link com DDI 55', () => {
        const link = linkWhatsApp('(43) 99846-8294', 'Oi');
        expect(link).toBe('https://wa.me/5543998468294?text=Oi');
        expect(linkWhatsApp('123', 'x')).toBeNull();
        expect(linkWhatsApp(null, 'x')).toBeNull();
    });

    it('mensagem de lembrete usa primeiro nome e data BR', () => {
        const m = mensagemWhatsApp('LEMBRETE', { cliente: 'Maria Silva', servicos: 'Drenagem', data: SEG, hora: '09:00', profissional: 'Ana' });
        expect(m).toContain('Olá, Maria!');
        expect(m).toContain('23/11/2026 às 09:00');
    });
});
