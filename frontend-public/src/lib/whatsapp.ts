export type ContatoWhatsApp = {
    /** Internacional (+5543998468294). Sem número, o WhatsApp pede para escolher o contato. */
    numero?: string | null;
    /** Quem atende: "Olá, Tayna!". Sem nome: "Olá!". */
    nome?: string | null;
};

export function whatsappUrl(
    opts: {
        protocolo?: string;
        modalidade?: string;
        pacote?: { sessoes: number };
        valePresente?: boolean;
    },
    contato: ContatoWhatsApp,
): string {
    const ola = contato.nome?.trim() ? `Olá, ${contato.nome.trim()}!` : 'Olá!';
    const alvo = [opts.protocolo, opts.modalidade].filter(Boolean).join(' – ');
    let msg: string;
    if (opts.valePresente) msg = `${ola} Quero presentear alguém com um vale-presente${alvo ? ` do ${alvo}` : ''}.`;
    else if (opts.pacote && alvo) msg = `${ola} Tenho interesse no pacote de ${opts.pacote.sessoes} sessões de ${alvo}.`;
    else if (alvo) msg = `${ola} Gostaria de agendar uma sessão de ${alvo}.`;
    else msg = `${ola} Gostaria de agendar uma sessão.`;
    const digitos = (contato.numero ?? '').replace(/\D/g, '');
    return `https://wa.me/${digitos}?text=${encodeURIComponent(msg)}`;
}

/** +5543998468294 → (43) 99846-8294. Outros países: como está salvo. */
export function formatarTelefone(numero: string): string {
    const d = numero.replace(/\D/g, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
        const ddd = d.slice(2, 4);
        const resto = d.slice(4);
        return `(${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
    }
    return numero;
}
