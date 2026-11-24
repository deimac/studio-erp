/**
 * Escopo de dados por profissional.
 * - Profissional: vê e controla só o que é dele.
 * - Admin no modo "Clínica" (veTudo): vê tudo ("GERAL") ou só o dele ("MEU"); gerencia tudo.
 * - Admin no modo "cada um cuida do seu": vê e controla só o dele, mais os registros
 *   sem dono (contas da sala, registros antigos).
 * Registros sem dono só o admin vê.
 */
import { eq, isNull, or, type Column, type SQL } from 'drizzle-orm';
import { z } from 'zod';

export type Sessao = { id: number; perfil: 'ADMIN' | 'PROFISSIONAL'; veTudo: boolean };
export type Escopo = 'GERAL' | 'MEU';

export const zEscopo = z.enum(['GERAL', 'MEU']).optional();

/** Id do profissional para filtrar as listas, ou null = sem filtro. */
export function filtroDono(s: Sessao, escopo?: Escopo): number | null {
    if (!s.veTudo) return s.id;
    return escopo === 'MEU' ? s.id : null;
}

/** Ao filtrar pelo próprio id, inclui os registros sem dono? (admin fora do modo Clínica) */
export function incluiSemDono(s: Sessao): boolean {
    return s.perfil === 'ADMIN' && !s.veTudo;
}

/** Condição SQL sobre a coluna de dono (undefined = sem filtro). */
export function condDono(col: Column, s: Sessao, escopo?: Escopo): SQL | undefined {
    const dono = filtroDono(s, escopo);
    if (dono == null) return undefined;
    return incluiSemDono(s) ? or(eq(col, dono), isNull(col)) : eq(col, dono);
}

/** O usuário pode ver/alterar um registro com este dono? */
export function podeGerenciar(dono: number | null | undefined, s: Sessao): boolean {
    if (s.veTudo) return true;
    if (dono == null) return s.perfil === 'ADMIN';
    return dono === s.id;
}
