import { ArrowDown, ArrowUp, ExternalLink, Trash2 } from 'lucide-react';
import { trpc } from '@/services/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { useToast } from '@/hooks/useToast';
import { ProtocoloForm, type Protocolo } from '@/components/ProtocoloForm';
import { resolveImageUrl } from '@/lib/media';

const SITE_URL = 'https://tsmassoterapeuta.com.br';

export default function Protocolos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();
    const listQ = trpc.protocolos.list.useQuery();
    const lista = (listQ.data ?? []) as Protocolo[];

    const invalidate = () => utils.protocolos.list.invalidate();
    const reorderMut = trpc.protocolos.reorder.useMutation({ onSuccess: invalidate });
    const deleteMut = trpc.protocolos.delete.useMutation({
        onSuccess: () => { invalidate(); toast({ title: 'Protocolo removido', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function mover(i: number, delta: number) {
        const ids = lista.map((p) => p.id);
        const j = i + delta;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        reorderMut.mutate({ ids });
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Protocolos</h2>
                    <p className="text-sm text-gray-500">O que aparece no site público. A ordem aqui é a ordem no site.</p>
                </div>
                <ProtocoloForm onSuccess={() => { invalidate(); toast({ title: 'Protocolo salvo!', variant: 'success' }); }} />
            </div>

            {listQ.isLoading && <p className="py-8 text-center text-gray-400">Carregando…</p>}
            {!listQ.isLoading && lista.length === 0 && <p className="py-8 text-center text-gray-400">Nenhum protocolo cadastrado.</p>}

            <div className="space-y-3">
                {lista.map((p, i) => (
                    <Card key={p.id}>
                        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-1 sm:flex-col">
                                <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0 || reorderMut.isPending} onClick={() => mover(i, -1)}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === lista.length - 1 || reorderMut.isPending} onClick={() => mover(i, 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                            {p.imagem_url ? (
                                <img src={resolveImageUrl(p.imagem_url)} alt={p.nome} className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                            ) : (
                                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-xs text-gray-400">sem foto</div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold">{p.nome}</p>
                                    {!p.ativo && <Badge variant="warning">Inativo</Badge>}
                                    {p.permite_vale_presente && <Badge variant="secondary">Vale-presente</Badge>}
                                </div>
                                {p.subtitulo && <p className="text-sm italic text-gray-500">{p.subtitulo}</p>}
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {(p.servicos ?? []).length === 0 && <span className="text-xs text-amber-600">Nenhuma modalidade vinculada — sem preço no site.</span>}
                                    {(p.servicos ?? []).map((s) => (
                                        <Badge key={s.id} variant="outline">{s.nome_modalidade || s.nome}</Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 self-end sm:self-center">
                                <a href={`${SITE_URL}/protocolos/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Ver no site">
                                    <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                                </a>
                                <ProtocoloForm protocolo={p} onSuccess={() => { invalidate(); toast({ title: 'Protocolo salvo!', variant: 'success' }); }} />
                                <Button
                                    size="sm" variant="ghost" aria-label="Excluir"
                                    onClick={async () => {
                                        const ok = await confirm({
                                            title: 'Excluir protocolo',
                                            description: `Excluir "${p.nome}"? Os serviços vinculados continuam existindo, só perdem o vínculo.`,
                                            confirmLabel: 'Excluir',
                                            variant: 'danger',
                                        });
                                        if (ok) deleteMut.mutate({ id: p.id });
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
