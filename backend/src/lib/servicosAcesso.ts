/**
 * Quem pode ver/usar/editar um serviço.
 * - Serviço da clínica (dono null): todos usam; só o admin edita.
 * - Serviço próprio de um profissional: só ele (e o admin) vê, usa e edita.
 */
export type Sessao = { id: number; perfil: 'ADMIN' | 'PROFISSIONAL' };

/** O usuário logado enxerga o serviço (listas, vendas)? */
export function podeVerServico(dono: number | null, s: Sessao): boolean {
    return s.perfil === 'ADMIN' || dono == null || dono === s.id;
}

/** O serviço pode ser feito pelo profissional do atendimento? */
export function servicoServeParaProfissional(dono: number | null, idProfissional: number): boolean {
    return dono == null || dono === idProfissional;
}

/** O usuário logado pode editar o serviço? */
export function podeEditarServico(dono: number | null, s: Sessao): boolean {
    return s.perfil === 'ADMIN' || (dono != null && dono === s.id);
}
