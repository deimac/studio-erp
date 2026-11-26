/** Helpers da agenda no admin. Datas 'YYYY-MM-DD', horas 'HH:MM'. */

export type StatusAtendimento = 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'FALTOU';

export const STATUS_INFO: Record<StatusAtendimento, { label: string; classe: string; ponto: string }> = {
    AGENDADO: { label: 'Agendado', classe: 'bg-blue-50 text-blue-700 border-blue-200', ponto: 'bg-blue-500' },
    CONFIRMADO: { label: 'Confirmado', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200', ponto: 'bg-emerald-500' },
    REALIZADO: { label: 'Realizado', classe: 'bg-gray-100 text-gray-700 border-gray-200', ponto: 'bg-gray-500' },
    FALTOU: { label: 'Faltou', classe: 'bg-amber-50 text-amber-700 border-amber-200', ponto: 'bg-amber-500' },
    CANCELADO: { label: 'Cancelado', classe: 'bg-red-50 text-red-700 border-red-200', ponto: 'bg-red-500' },
};

export const STATUS_ABERTOS: StatusAtendimento[] = ['AGENDADO', 'CONFIRMADO'];

/** Cores sugeridas para profissionais e salas. */
export const PALETA = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#c026d3', '#475569'];

export function corPadrao(id: number, cor?: string | null) {
    return cor || PALETA[(id - 1) % PALETA.length];
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const pad = (n: number) => String(n).padStart(2, '0');

export function dataISO(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hoje (AAAA-MM-DD); não se agenda antes disso. */
export function hojeISO() {
    return dataISO(new Date());
}

export function horaHHMM(d: Date) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function paraDate(data: string, hora = '00:00') {
    const [a, m, d] = data.split('-').map(Number);
    const [h, min] = hora.split(':').map(Number);
    return new Date(a, m - 1, d, h, min);
}

export function minutos(hora: string) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

export function somarMinutos(hora: string, mins: number) {
    const t = minutos(hora) + mins;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}

export function dataBR(data: string) {
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a}`;
}
