/**
 * Quem pode ver/usar/editar um serviço (vale também para técnicas).
 * - Serviço da clínica (dono null): o admin e os profissionais que o admin
 *   liberou ("usa os serviços da clínica"). Só o admin edita.
 * - Serviço próprio de um profissional: só ele (e o admin no modo Clínica) vê, usa e edita.
 *   No modo "cada um cuida do seu" (veTudo = false), o admin não vê os serviços dos colegas.
 */
export type Sessao = { id: number; perfil: 'ADMIN' | 'PROFISSIONAL' | 'ESPECTADOR'; veTudo: boolean; veServicosClinica?: boolean };

/** O usuário logado enxerga o serviço (listas, vendas)? */
export function podeVerServico(dono: number | null, s: Sessao): boolean {
    if (s.veTudo || (dono != null && dono === s.id)) return true;
    return dono == null && (s.perfil === 'ADMIN' || Boolean(s.veServicosClinica));
}

/**
 * O serviço pode ser feito/vendido pelo profissional?
 * `usaClinica`: o profissional usa os serviços da clínica (admin: sempre).
 * `quemAtende`: profissionais indicados no serviço da clínica (vazio = todos).
 */
export function servicoServeParaProfissional(dono: number | null, idProfissional: number, usaClinica = true, quemAtende: number[] = []): boolean {
    if (dono != null) return dono === idProfissional;
    return usaClinica && (quemAtende.length === 0 || quemAtende.includes(idProfissional));
}

/** O usuário logado pode editar o serviço? */
export function podeEditarServico(dono: number | null, s: Sessao): boolean {
    if (s.veTudo) return true;
    if (dono == null) return s.perfil === 'ADMIN';
    return dono === s.id;
}
