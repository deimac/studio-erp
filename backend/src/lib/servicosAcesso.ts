/**
 * Quem pode ver/usar/editar um serviço (vale também para técnicas).
 * - Serviço da clínica (dono null): o admin e os profissionais que o admin
 *   liberou ("usa os serviços da clínica"). Só o admin edita.
 * - Serviço próprio de um profissional: só ele (e o admin) vê, usa e edita.
 */
export type Sessao = { id: number; perfil: 'ADMIN' | 'PROFISSIONAL'; veServicosClinica?: boolean };

/** O usuário logado enxerga o serviço (listas, vendas)? */
export function podeVerServico(dono: number | null, s: Sessao): boolean {
    if (s.perfil === 'ADMIN' || (dono != null && dono === s.id)) return true;
    return dono == null && Boolean(s.veServicosClinica);
}

/**
 * O serviço pode ser feito/vendido pelo profissional?
 * `usaClinica`: o profissional usa os serviços da clínica (admin: sempre).
 */
export function servicoServeParaProfissional(dono: number | null, idProfissional: number, usaClinica = true): boolean {
    if (dono != null) return dono === idProfissional;
    return usaClinica;
}

/** O usuário logado pode editar o serviço? */
export function podeEditarServico(dono: number | null, s: Sessao): boolean {
    return s.perfil === 'ADMIN' || (dono != null && dono === s.id);
}
