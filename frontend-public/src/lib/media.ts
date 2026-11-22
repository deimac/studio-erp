const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function resolveImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return API_URL ? `${API_URL}${url}` : url;
    return API_URL ? `${API_URL}/${url}` : `/${url}`;
}

/** Imagem padrão de cada protocolo enquanto nenhuma é enviada pelo admin. */
export function imagemProtocolo(p: { slug: string; imagem_url?: string | null }): string {
    return resolveImageUrl(p.imagem_url) || `/images/protocolos/${p.slug}.jpg?v=3`;
}

/** onError de <img>: troca por uma imagem genérica (uma única vez). */
export function imagemReserva(e: { currentTarget: HTMLImageElement }) {
    const img = e.currentTarget;
    if (img.dataset.reserva) return;
    img.dataset.reserva = '1';
    img.src = '/images/site/hero.jpg?v=2';
}
