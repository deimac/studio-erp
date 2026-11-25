import { trpc } from '@/services/trpc';

export type ProtocoloResumo = {
    id: number;
    nome: string;
    slug: string;
    subtitulo: string | null;
    icone: string | null;
    imagem_url: string | null;
    permite_vale_presente: boolean;
    a_partir_de: number | null;
    duracoes: number[];
};

export type Pacote = { id: number; nome: string; quantidade_sessoes: number; valor_total: string };
export type Modalidade = {
    id: number;
    nome: string;
    nome_modalidade: string | null;
    duracao_minutos: number;
    valor: string;
    regioes: string[];
    pacotes: Pacote[];
};
export type ProtocoloDetalhe = ProtocoloResumo & {
    descricao: string | null;
    inclui: string[];
    beneficios: string[];
    aviso: string | null;
    frase_final: string | null;
    modalidades: Modalidade[];
};
export type SiteConfig = Partial<Record<
    'hero_imagem_url' | 'sobre_imagem_url' | 'hero_titulo' | 'hero_subtitulo' | 'instagram' | 'nome_mensagem' | 'rodape_texto' | 'rodape_assinatura',
    string
>>;

// O tipo do AppRouter não é exportado para o site (AppRouter = any), por isso o cast.
const api = trpc as any;

export function useProtocolos() {
    const q = api.public.listProtocolos.useQuery();
    return { ...q, data: (q.data ?? undefined) as ProtocoloResumo[] | undefined };
}

export function useProtocolo(slug: string) {
    const q = api.public.getProtocoloBySlug.useQuery({ slug }, { enabled: !!slug });
    return { ...q, data: q.data as ProtocoloDetalhe | null | undefined };
}

export function useSiteConfig(): SiteConfig {
    const q = api.public.getSiteConfig.useQuery(undefined, { staleTime: 5 * 60_000 });
    return (q.data ?? {}) as SiteConfig;
}
