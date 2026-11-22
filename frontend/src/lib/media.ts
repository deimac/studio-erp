const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const UPLOAD_URL = API_URL ? `${API_URL}/api/upload` : '/api/upload';

export function resolveImageUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return API_URL ? `${API_URL}${url}` : url;
    return API_URL ? `${API_URL}/${url}` : `/${url}`;
}
