/**
 * Perfil "Espectador": só olha a agenda compartilhada e os serviços da clínica.
 * Tudo o que não está nesta lista é recusado pelo servidor (vale também para rotas novas).
 */
const ROTAS_ESPECTADOR = new Set([
    'usuarios.me',
    'usuarios.meusAtalhos',
    'agenda.eventos',
    'agenda.profissionais.list',
    'agenda.salas.list',
    'agenda.feriados.list',
    'servicos.list',
    'servicos.getById',
    'protocolos.list',
    'pacotes.list',
    'tecnicas.list',
]);

/** O espectador pode chamar esta rota? (só leituras) */
export function podeEspectador(path: string, tipo: string): boolean {
    return tipo === 'query' && ROTAS_ESPECTADOR.has(path);
}
