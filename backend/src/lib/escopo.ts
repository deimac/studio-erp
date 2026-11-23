/**
 * Escopo de dados por profissional.
 * - Profissional: vê e controla só o que é dele.
 * - Admin: vê tudo ("GERAL") ou só o dele ("MEU"); pode gerenciar tudo.
 * Registros sem dono (legado) só o admin vê.
 */
import { z } from 'zod';

export type Sessao = { id: number; perfil: 'ADMIN' | 'PROFISSIONAL' };
export type Escopo = 'GERAL' | 'MEU';

export const zEscopo = z.enum(['GERAL', 'MEU']).optional();

/** Id do profissional para filtrar as listas, ou null = sem filtro. */
export function filtroDono(s: Sessao, escopo?: Escopo): number | null {
    if (s.perfil !== 'ADMIN') return s.id;
    return escopo === 'MEU' ? s.id : null;
}

/** O usuário pode ver/alterar um registro com este dono? */
export function podeGerenciar(dono: number | null | undefined, s: Sessao): boolean {
    return s.perfil === 'ADMIN' || (dono != null && dono === s.id);
}
