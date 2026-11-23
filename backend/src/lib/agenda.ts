/**
 * Regras puras da agenda (sem banco): horários, conflitos, recorrência e WhatsApp.
 * Datas são strings 'YYYY-MM-DD'; horários são minutos desde 00:00.
 */

export type StatusAtendimento = 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU';

/** Status que ainda ocupam o horário. */
export const STATUS_OCUPAM: readonly StatusAtendimento[] = ['AGENDADO', 'CONFIRMADO', 'REALIZADO'];

export type Intervalo = { inicio: number; fim: number };

export type Ocupacao = Intervalo & {
    id: number;
    data: string;
    id_profissional: number;
    id_sala: number | null;
    status: StatusAtendimento;
};

export type BloqueioAgenda = {
    id: number;
    id_profissional: number | null;
    id_sala: number | null;
    /** 'YYYY-MM-DD HH:MM[:SS]' */
    inicio: string;
    fim: string;
    motivo?: string | null;
};

export type HorarioTrabalho = Intervalo & { dia_semana: number };

export type TipoConflito = 'PROFISSIONAL_OCUPADO' | 'AGENDA_COMPARTILHADA' | 'SALA_OCUPADA' | 'BLOQUEIO' | 'FORA_DO_EXPEDIENTE';

export type Conflito = { tipo: TipoConflito; mensagem: string; id?: number };

/* ----------------------------- horários ----------------------------- */

export function hhmmParaMin(v: string): number {
    const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
    if (!m) throw new Error(`Horário inválido: ${v}`);
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || min > 59) throw new Error(`Horário inválido: ${v}`);
    return h * 60 + min;
}

export function minParaHHMM(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function validarData(data: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error(`Data inválida: ${data}`);
    const d = new Date(`${data}T00:00:00Z`);
    if (isNaN(d.getTime())) throw new Error(`Data inválida: ${data}`);
    return d;
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(data: string): number {
    return validarData(data).getUTCDay();
}

export function somarDias(data: string, dias: number): string {
    const d = validarData(data);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

export function formatarDataBR(data: string): string {
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a}`;
}

/* ----------------------------- conflitos ----------------------------- */

/** Encostar (fim de um = início do outro) não é sobreposição. */
export function intervalosSobrepoem(a: Intervalo, b: Intervalo): boolean {
    return a.inicio < b.fim && b.inicio < a.fim;
}

/** Parte do bloqueio que cai no dia informado, em minutos; null se não toca o dia. */
export function bloqueioNoDia(b: Pick<BloqueioAgenda, 'inicio' | 'fim'>, data: string): Intervalo | null {
    const [di, hi] = b.inicio.split(/[ T]/);
    const [df, hf] = b.fim.split(/[ T]/);
    if (data < di || data > df) return null;
    const inicio = data === di ? hhmmParaMin(hi ?? '00:00') : 0;
    const fim = data === df ? hhmmParaMin(hf ?? '00:00') : 24 * 60;
    return fim > inicio ? { inicio, fim } : null;
}

/** O intervalo está inteiramente dentro de algum período de trabalho do dia? */
export function dentroDoExpediente(intervalo: Intervalo, data: string, horarios: HorarioTrabalho[]): boolean {
    const dia = diaSemana(data);
    return horarios.some((h) => h.dia_semana === dia && h.inicio <= intervalo.inicio && intervalo.fim <= h.fim);
}

export type NovoAgendamento = Intervalo & {
    data: string;
    id_profissional: number;
    id_sala: number | null;
    /** Ao editar, o próprio atendimento é ignorado. */
    ignorarId?: number;
};

export function verificarConflitos(args: {
    novo: NovoAgendamento;
    existentes: Ocupacao[];
    bloqueios: BloqueioAgenda[];
    horarios: HorarioTrabalho[];
    /**
     * Profissionais que dividem o mesmo espaço: um horário ocupado por qualquer
     * um deles bloqueia todos os outros do grupo.
     */
    compartilhados?: number[];
}): Conflito[] {
    const { novo, existentes, bloqueios, horarios } = args;
    const grupo = new Set(args.compartilhados ?? []);
    const novoNoGrupo = grupo.has(novo.id_profissional);
    const conflitos: Conflito[] = [];
    if (novo.fim <= novo.inicio) {
        throw new Error('O horário final deve ser depois do inicial');
    }

    for (const e of existentes) {
        if (e.id === novo.ignorarId || e.data !== novo.data) continue;
        if (!STATUS_OCUPAM.includes(e.status)) continue;
        if (!intervalosSobrepoem(novo, e)) continue;
        const faixa = `${minParaHHMM(e.inicio)}–${minParaHHMM(e.fim)}`;
        if (e.id_profissional === novo.id_profissional) {
            conflitos.push({ tipo: 'PROFISSIONAL_OCUPADO', id: e.id, mensagem: `Profissional já tem atendimento das ${faixa}` });
        } else if (novoNoGrupo && grupo.has(e.id_profissional)) {
            conflitos.push({ tipo: 'AGENDA_COMPARTILHADA', id: e.id, mensagem: `Horário já ocupado na agenda compartilhada (${faixa})` });
        } else if (novo.id_sala != null && e.id_sala === novo.id_sala) {
            conflitos.push({ tipo: 'SALA_OCUPADA', id: e.id, mensagem: `Sala ocupada das ${faixa}` });
        }
    }

    for (const b of bloqueios) {
        const aplica =
            (b.id_profissional == null && b.id_sala == null) ||
            (b.id_profissional != null && b.id_profissional === novo.id_profissional) ||
            (b.id_sala != null && b.id_sala === novo.id_sala);
        if (!aplica) continue;
        const faixa = bloqueioNoDia(b, novo.data);
        if (faixa && intervalosSobrepoem(novo, faixa)) {
            conflitos.push({ tipo: 'BLOQUEIO', id: b.id, mensagem: `Horário bloqueado${b.motivo ? `: ${b.motivo}` : ''}` });
        }
    }

    if (!dentroDoExpediente(novo, novo.data, horarios)) {
        conflitos.push({ tipo: 'FORA_DO_EXPEDIENTE', mensagem: 'Fora do expediente do profissional' });
    }

    return conflitos;
}

/** Conflitos que impedem salvar. Só o admin pode forçar "fora do expediente". */
export function conflitosImpeditivos(conflitos: Conflito[], opts: { isAdmin: boolean; forcar?: boolean }): Conflito[] {
    return conflitos.filter((c) => !(c.tipo === 'FORA_DO_EXPEDIENTE' && opts.isAdmin && opts.forcar));
}

/* ----------------------------- cálculo ----------------------------- */

export function calcularFim(inicio: number, duracoes: number[]): number {
    const total = duracoes.reduce((s, d) => s + d, 0);
    if (total <= 0) throw new Error('Duração total deve ser maior que zero');
    return inicio + total;
}

export function gerarOcorrencias(dataInicial: string, quantidade: number, intervaloSemanas = 1): string[] {
    if (quantidade < 1) return [];
    return Array.from({ length: quantidade }, (_, i) => somarDias(dataInicial, i * 7 * intervaloSemanas));
}

/** Horários de início livres para a duração pedida, dentro do expediente. */
export function horariosLivres(args: {
    data: string;
    duracao: number;
    passo: number;
    id_profissional: number;
    id_sala: number | null;
    horarios: HorarioTrabalho[];
    existentes: Ocupacao[];
    bloqueios: BloqueioAgenda[];
    compartilhados?: number[];
}): string[] {
    const { data, duracao, passo } = args;
    const dia = diaSemana(data);
    const livres: string[] = [];
    const periodos = args.horarios.filter((h) => h.dia_semana === dia).sort((a, b) => a.inicio - b.inicio);
    for (const p of periodos) {
        for (let inicio = p.inicio; inicio + duracao <= p.fim; inicio += passo) {
            const conflitos = verificarConflitos({
                novo: { data, inicio, fim: inicio + duracao, id_profissional: args.id_profissional, id_sala: args.id_sala },
                existentes: args.existentes,
                bloqueios: args.bloqueios,
                horarios: args.horarios,
                compartilhados: args.compartilhados,
            });
            if (conflitos.length === 0) livres.push(minParaHHMM(inicio));
        }
    }
    return livres;
}

/* ----------------------------- WhatsApp ----------------------------- */

export type DadosMensagem = {
    cliente: string;
    servicos: string;
    data: string;
    hora: string;
    profissional: string;
};

export function mensagemWhatsApp(tipo: 'CONFIRMACAO' | 'LEMBRETE', d: DadosMensagem): string {
    const primeiroNome = d.cliente.trim().split(/\s+/)[0];
    const quando = `${formatarDataBR(d.data)} às ${d.hora}`;
    if (tipo === 'LEMBRETE') {
        return `Olá, ${primeiroNome}! Passando para lembrar do seu horário de ${d.servicos} em ${quando}, com ${d.profissional}. Podemos confirmar sua presença?`;
    }
    return `Olá, ${primeiroNome}! Seu horário de ${d.servicos} está agendado para ${quando}, com ${d.profissional}. Qualquer dúvida é só responder por aqui.`;
}

/** Link wa.me; retorna null se o telefone não parecer um celular/fixo brasileiro. */
export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
    if (!telefone) return null;
    let digitos = telefone.replace(/\D/g, '');
    if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
    if (digitos.length < 12 || digitos.length > 13) return null;
    return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
