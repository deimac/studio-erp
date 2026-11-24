import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { dataISO } from '@/lib/agenda';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

function amanha() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return dataISO(d);
}

/** Lista os atendimentos do dia (padrão: amanhã) com o botão de lembrete no WhatsApp. */
export function LembretesDialog({ open, onOpenChange }: Props) {
    const utils = trpc.useUtils();
    const [data, setData] = useState(amanha());
    useEffect(() => { if (open) setData(amanha()); }, [open]);

    const q = trpc.agenda.lembretes.useQuery({ data }, { enabled: open && !!data });
    const marcar = trpc.agenda.marcarLembreteEnviado.useMutation({
        onSuccess: () => { utils.agenda.lembretes.invalidate(); utils.agenda.eventos.invalidate(); },
    });
    const itens = (q.data ?? []) as any[];
    const pendentes = itens.filter((i) => !i.lembrete_enviado_em).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Lembretes por WhatsApp</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 text-sm">
                    <Input type="date" className="w-44" value={data} onChange={(e) => setData(e.target.value)} />
                    <span className="text-[hsl(var(--muted-foreground))]">
                        {q.isLoading ? 'Carregando…' : `${itens.length} atendimento(s), ${pendentes} sem lembrete`}
                    </span>
                </div>
                <ul className="divide-y rounded-md border">
                    {itens.map((i) => (
                        <li key={i.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                            <span className="w-12 font-mono font-semibold">{i.hora}</span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{i.cliente}</p>
                                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{[i.servicos, i.profissional].filter(Boolean).join(' · ')}</p>
                            </div>
                            {i.lembrete_enviado_em ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> enviado</span>
                            ) : i.link ? (
                                <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => { window.open(i.link, '_blank', 'noopener'); marcar.mutate({ id: i.id }); }}>
                                    <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar
                                </Button>
                            ) : (
                                <span className="text-xs text-amber-600">sem telefone</span>
                            )}
                        </li>
                    ))}
                    {!q.isLoading && !itens.length && <li className="px-3 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhum atendimento neste dia.</li>}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
