import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    inicial?: { data?: string; hora_inicio?: string; hora_fim?: string; id_profissional?: number | null; id_sala?: number | null };
};

/** Bloqueio de horário: almoço, folga, férias, feriado (clínica inteira), manutenção de sala. */
export function BloqueioForm({ open, onOpenChange, inicial }: Props) {
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open && isAdmin });
    const salasQ = trpc.agenda.salas.list.useQuery(undefined, { enabled: open && isAdmin });

    const [alvo, setAlvo] = useState<string>('');
    const [dataIni, setDataIni] = useState('');
    const [horaIni, setHoraIni] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [motivo, setMotivo] = useState('');

    useEffect(() => {
        if (!open) return;
        const p = inicial?.id_profissional ?? (isAdmin ? null : user?.id);
        setAlvo(inicial?.id_sala ? `s:${inicial.id_sala}` : p ? `p:${p}` : 'clinica');
        setDataIni(inicial?.data ?? '');
        setDataFim(inicial?.data ?? '');
        setHoraIni(inicial?.hora_inicio ?? '08:00');
        setHoraFim(inicial?.hora_fim ?? '18:00');
        setMotivo('');
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const criar = trpc.agenda.bloqueios.create.useMutation({
        onSuccess: () => {
            utils.agenda.eventos.invalidate();
            utils.agenda.disponibilidade.invalidate();
            toast({ title: 'Horário bloqueado', variant: 'success' });
            onOpenChange(false);
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function salvar(e: React.FormEvent) {
        e.preventDefault();
        if (!dataIni || !dataFim || !horaIni || !horaFim) return toast({ title: 'Preencha início e fim', variant: 'error' });
        const [tipo, idStr] = alvo.split(':');
        criar.mutate({
            id_profissional: tipo === 'p' ? Number(idStr) : null,
            id_sala: tipo === 's' ? Number(idStr) : null,
            inicio: `${dataIni} ${horaIni}`,
            fim: `${dataFim} ${horaFim}`,
            motivo: motivo.trim() || undefined,
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Bloquear horário</DialogTitle>
                </DialogHeader>
                <form onSubmit={salvar} className="space-y-4">
                    {isAdmin && (
                        <div className="space-y-1.5">
                            <Label>Bloquear para</Label>
                            <select aria-label="Bloquear para" className="w-full rounded-md border px-3 py-2 text-sm" value={alvo} onChange={(e) => setAlvo(e.target.value)}>
                                <option value="clinica">Clínica inteira (feriado, evento)</option>
                                <optgroup label="Profissional">
                                    {((profsQ.data ?? []) as any[]).map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nome}</option>)}
                                </optgroup>
                                <optgroup label="Sala / maca">
                                    {((salasQ.data ?? []) as any[]).map((s) => <option key={s.id} value={`s:${s.id}`}>{s.nome}</option>)}
                                </optgroup>
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>De</Label>
                            <Input type="date" value={dataIni} onChange={(e) => { setDataIni(e.target.value); if (!dataFim || dataFim < e.target.value) setDataFim(e.target.value); }} />
                            <Input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Até</Label>
                            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                            <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Motivo</Label>
                        <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Almoço, férias, curso…" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={criar.isPending}>Bloquear</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
