import { useCallback, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';
import { UPLOAD_URL, resolveImageUrl } from '@/lib/media';

/** Upload de imagem com arrastar-e-soltar. `value` é a URL atual; `onChange` recebe a nova URL ('' para remover). */
export function ImageUpload({ value, onChange, hint }: { value?: string | null; onChange: (url: string) => void; hint?: string }) {
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const preview = resolveImageUrl(value);

    async function handleUpload(file: File) {
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Apenas imagens são permitidas', variant: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Imagem deve ter no máximo 5 MB', variant: 'error' });
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await fetch(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: { Authorization: `Bearer ${localStorage.getItem('studio_erp_token')}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? 'Upload falhou');
            }
            const data = await res.json();
            onChange(resolveImageUrl(data.url));
            toast({ title: 'Imagem enviada!', variant: 'success' });
        } catch (e: any) {
            toast({ title: e?.message ?? 'Erro ao enviar imagem', variant: 'error' });
        } finally {
            setUploading(false);
        }
    }

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <div
                className={`mt-1 rounded-lg border-2 border-dashed p-4 transition-colors text-center cursor-pointer ${dragging
                    ? 'border-[hsl(var(--primary))] bg-blue-50'
                    : preview
                        ? 'border-transparent bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                onDrop={onDrop}
                onClick={() => !uploading && fileRef.current?.click()}
            >
                {preview ? (
                    <div className="flex items-center gap-4">
                        <img src={preview} alt="Pré-visualização" className="h-20 w-20 rounded-lg object-cover border shadow-sm" />
                        <div className="flex flex-col gap-1 text-left">
                            <p className="text-sm font-medium text-gray-700">Imagem selecionada</p>
                            <p className="text-xs text-gray-400">Clique ou arraste para trocar</p>
                            <Button
                                type="button" size="sm" variant="ghost"
                                className="text-xs text-red-500 w-fit px-0 h-auto"
                                onClick={(e) => { e.stopPropagation(); onChange(''); }}
                            >
                                Remover imagem
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                        {uploading ? (
                            <>
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[hsl(var(--primary))]" />
                                <p className="text-sm text-gray-500">Enviando…</p>
                            </>
                        ) : (
                            <>
                                <ImagePlus className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-500">Arraste uma imagem aqui ou <span className="text-[hsl(var(--primary))] font-medium">clique para selecionar</span></p>
                                <p className="text-xs text-gray-400">{hint ?? 'PNG, JPG ou WEBP • Máx. 5 MB'}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Upload de imagem"
                onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
        </>
    );
}
