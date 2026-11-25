import { useCallback } from 'react';
import { trpc } from '@/services/trpc';
import { useSiteConfig } from '@/lib/catalogo';
import { whatsappUrl } from '@/lib/whatsapp';

export type UnidadeSite = {
    id: number;
    nome: string;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    whatsapp: string | null;
};

const api = trpc as any;

export function mapaUrl(u: UnidadeSite): string {
    const busca = [u.endereco, u.bairro, u.cidade].filter(Boolean).join(' - ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(busca);
}

/** Contato do site: unidades (configuradas no admin) e dados da marca. */
export function useContato() {
    const q = api.public.listUnidades.useQuery(undefined, { staleTime: 5 * 60_000 });
    const config = useSiteConfig();
    const unidades = (q.data ?? []) as UnidadeSite[];
    const principal = unidades.find((u) => u.whatsapp) ?? unidades[0];
    const instagram = config.instagram?.replace(/^@/, '') || null;
    return {
        unidades,
        principal,
        instagram,
        instagramUrl: instagram ? `https://instagram.com/${instagram}` : null,
        nomeMensagem: config.nome_mensagem || null,
        rodapeTexto: config.rodape_texto || null,
        assinatura: config.rodape_assinatura || null,
    };
}

/** Link do WhatsApp da unidade principal, com a mensagem pronta. */
export function useWhatsapp() {
    const { principal, nomeMensagem } = useContato();
    const numero = principal?.whatsapp ?? null;
    return useCallback(
        (opts: Parameters<typeof whatsappUrl>[0] = {}) => whatsappUrl(opts, { numero, nome: nomeMensagem }),
        [numero, nomeMensagem],
    );
}
