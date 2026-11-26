import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ATALHOS, LUGARES, PADRAO, useBarra, useSalvarBarra, type AtalhoId } from '@/lib/barra';
import { cn } from '@/lib/utils';

/** Escolher os 4 atalhos da barra de baixo do celular (salvo no cadastro de cada profissional). */
export function PersonalizarBarra({ aoSalvar }: { aoSalvar?: () => void }) {
    const { isAdmin } = useAuth();
    const { toast } = useToast();
    const atual = useBarra(isAdmin);
    const salvarMut = useSalvarBarra();
    const [escolha, setEscolha] = useState<AtalhoId[]>(atual);
    const opcoes = ATALHOS.filter((a) => isAdmin || !a.adminOnly);
    const cheia = escolha.length === LUGARES;

    const alternar = (id: AtalhoId) =>
        setEscolha((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < LUGARES ? [...l, id] : l));

    const salvar = () =>
        salvarMut.mutate({ ids: escolha }, {
            onSuccess: () => { toast({ title: 'Barra atualizada', variant: 'success' }); aoSalvar?.(); },
            onError: () => toast({ title: 'Não foi possível salvar', variant: 'error' }),
        });

    const lugar = (i: number) => {
        const a = ATALHOS.find((x) => x.id === escolha[i]);
        return (
            <div key={i} className={cn('flex min-w-0 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium',
                a ? 'text-[hsl(var(--foreground))]' : 'border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')}>
                {a ? <a.icone className="h-5 w-5" /> : <span className="h-5 w-5" />}
                <span className="w-full truncate text-center">{a?.label ?? 'Vazio'}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Escolha <strong>{LUGARES} atalhos</strong> para a sua barra de baixo do celular, na ordem em que aparecem. O botão + fica sempre no meio. Cada profissional escolhe a sua.
            </p>

            {/* Como vai ficar */}
            <div className="mx-auto grid max-w-sm grid-cols-5 items-center gap-1 rounded-xl border bg-[hsl(var(--card))] p-2">
                {lugar(0)}{lugar(1)}
                <div className="flex justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Plus className="h-6 w-6" /></span>
                </div>
                {lugar(2)}{lugar(3)}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {opcoes.map((a) => {
                    const pos = escolha.indexOf(a.id);
                    const marcado = pos >= 0;
                    return (
                        <button key={a.id} type="button" onClick={() => alternar(a.id)} disabled={!marcado && cheia}
                            aria-pressed={marcado}
                            className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40',
                                marcado ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 font-medium' : 'hover:bg-[hsl(var(--accent))]')}>
                            <a.icone className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{a.label}</span>
                            {marcado && (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[11px] font-bold text-[hsl(var(--primary-foreground))]">{pos + 1}</span>
                            )}
                        </button>
                    );
                })}
            </div>
            {cheia ? null : <p className="text-xs text-[hsl(var(--muted-foreground))]">Falta{LUGARES - escolha.length > 1 ? 'm' : ''} {LUGARES - escolha.length}. Toque num marcado para tirar.</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setEscolha(PADRAO)}>Voltar ao padrão</Button>
                <Button onClick={salvar} disabled={!cheia || salvarMut.isPending}><Check className="mr-1.5 h-4 w-4" /> Salvar</Button>
            </div>
        </div>
    );
}

export function PersonalizarBarraDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>Barra do celular</DialogTitle>
                </DialogHeader>
                {open && <PersonalizarBarra aoSalvar={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}
