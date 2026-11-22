export const WHATSAPP_NUMERO = '5543998468294';

export function whatsappUrl(opts: {
    protocolo?: string;
    modalidade?: string;
    pacote?: { sessoes: number };
    valePresente?: boolean;
}): string {
    const alvo = [opts.protocolo, opts.modalidade].filter(Boolean).join(' – ');
    let msg: string;
    if (opts.valePresente) msg = `Olá, Tayna! Quero presentear alguém com um vale-presente${alvo ? ` do ${alvo}` : ''}.`;
    else if (opts.pacote && alvo) msg = `Olá, Tayna! Tenho interesse no pacote de ${opts.pacote.sessoes} sessões de ${alvo}.`;
    else if (alvo) msg = `Olá, Tayna! Gostaria de agendar uma sessão de ${alvo}.`;
    else msg = 'Olá, Tayna! Gostaria de agendar uma sessão.';
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;
}
