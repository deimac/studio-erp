import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { DIAS_SEMANA, PALETA } from '@/lib/agenda';
import { TelefoneInput } from '@/components/TelefoneInput';
import { cn } from '@/lib/utils';

type Periodo = { dia_semana: number; hora_inicio: string; hora_fim: string };

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    profissional: { id: number; nome: string; perfil?: string; cor?: string | null; telefone?: string | null; agenda_compartilhada?: boolean; ve_servicos_clinica?: boolean; falta_regra?: string | null } | null;
    /** Admin também edita os serviços que o profissional executa. */
    admin?: boolean;
};

/** Expediente semanal, cor, telefone e serviços de um profissional. */
export function ExpedienteDialog({ open, onOpenChange, profissional, admin }: Props) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const id = profissional?.id ?? 0;

    const horariosQ = trpc.agenda.horarios.get.useQuery({ id_profissional: id }, { enabled: open && !!id });
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open && !!admin });
    const servProfQ = trpc.agenda.profissionais.servicos.useQuery({ id_profissional: id }, { enabled: open && !!id && !!admin });

    const [periodos, setPeriodos] = useState<Periodo[]>([]);
    const [intervalo, setIntervalo] = useState(30);
    const [cor, setCor] = useState<string>('');
    const [telefone, setTelefone] = useState('');
    const [servicosSel, setServicosSel] = useState<number[]>([]);
    const [compartilhada, setCompartilhada] = useState(true);
    const [usaClinica, setUsaClinica] = useState(false);
    const [faltaRegra, setFaltaRegra] = useState<string>('');
    const regraQ = trpc.agenda.profissionais.regraFalta.useQuery({ id_profissional: id }, { enabled: open && !!id });
    const porProfissional = !!(regraQ.data as any)?.porProfissional;
    const ehAdmin = profissional?.perfil === 'ADMIN';

    useEffect(() => {
        if (!open || !horariosQ.data) return;
        const d = horariosQ.data as any;
        setPeriodos(d.periodos);
        setIntervalo(d.intervalo_agenda_min);
    }, [open, horariosQ.data]);
    useEffect(() => {
        if (!open) return;
        setCor(profissional?.cor ?? '');
        setTelefone(profissional?.telefone ?? '');
        setCompartilhada(profissional?.agenda_compartilhada ?? true);
        setUsaClinica(profissional?.ve_servicos_clinica ?? false);
        setFaltaRegra(profissional?.falta_regra ?? '');
    }, [open, profissional]);
    useEffect(() => {
        if (open && servProfQ.data) setServicosSel(servProfQ.data as number[]);
    }, [open, servProfQ.data]);

    const setHorarios = trpc.agenda.horarios.set.useMutation();
    const setPerfil = trpc.agenda.profissionais.update.useMutation();
    const setServicos = trpc.agenda.profissionais.setServicos.useMutation();
    const salvando = setHorarios.isPending || setPerfil.isPending || setServicos.isPending;

    async function salvar() {
        try {
            await setHorarios.mutateAsync({ id_profissional: id, intervalo_agenda_min: intervalo, periodos });
            await setPerfil.mutateAsync({ id, cor: cor || null, telefone: telefone.trim() || null, ...(porProfissional ? { falta_regra: (faltaRegra || null) as any } : {}), ...(admin ? { agenda_compartilhada: compartilhada, ...(ehAdmin ? {} : { ve_servicos_clinica: usaClinica }) } : {}) });
            if (admin) await setServicos.mutateAsync({ id_profissional: id, servicos: usaClinica || ehAdmin ? servicosSel : [] });
            utils.agenda.invalidate();
            toast({ title: 'Agenda do profissional salva', variant: 'success' });
            onOpenChange(false);
        } catch (e: any) {
            toast({ title: e.message, variant: 'error' });
        }
    }

    const atualizar = (i: number, campo: keyof Periodo, valor: string | number) =>
        setPeriodos((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));

    function copiarSegundaParaSemana() {
        const seg = periodos.filter((p) => p.dia_semana === 1);
        if (!seg.length) return toast({ title: 'Cadastre a segunda-feira primeiro', variant: 'error' });
        const outros = periodos.filter((p) => p.dia_semana === 0 || p.dia_semana === 1 || p.dia_semana === 6);
        const copias = [2, 3, 4, 5].flatMap((d) => seg.map((p) => ({ ...p, dia_semana: d })));
        setPeriodos([...outros, ...copias]);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Agenda de {profissional?.nome}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Cor na agenda</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {PALETA.map((c) => (
                                <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setCor(c)}
                                    className={cn('h-6 w-6 rounded-full ring-offset-2', cor === c && 'ring-2 ring-gray-900')} style={{ background: c }} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Telefone</Label>
                        <TelefoneInput value={telefone} onChange={setTelefone} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Grade da agenda</Label>
                        <select aria-label="Intervalo" className="w-full rounded-md border px-3 py-2 text-sm" value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
                            {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                        </select>
                    </div>
                </div>

                {admin && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={compartilhada} onChange={(e) => setCompartilhada(e.target.checked)} />
                        <span>
                            <span className="font-medium">Agenda compartilhada</span>
                            <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                                Divide o espaço com os outros profissionais marcados: se um agendar um horário, os demais não podem usar o mesmo horário.
                            </span>
                        </span>
                    </label>
                )}

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Expediente semanal</Label>
                        <button type="button" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={copiarSegundaParaSemana}>
                            Copiar segunda para ter–sex
                        </button>
                    </div>
                    <div className="divide-y rounded-md border">
                        {DIAS_SEMANA.map((nome, dia) => {
                            const doDia = periodos.map((p, i) => ({ p, i })).filter((x) => x.p.dia_semana === dia);
                            return (
                                <div key={dia} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                                    <span className="w-20 font-medium">{nome}</span>
                                    {doDia.length === 0 && <span className="text-[hsl(var(--muted-foreground))]">Folga</span>}
                                    {doDia.map(({ p, i }) => (
                                        <span key={i} className="inline-flex items-center gap-1">
                                            <Input type="time" className="h-8 w-[6.5rem]" value={p.hora_inicio} onChange={(e) => atualizar(i, 'hora_inicio', e.target.value)} />
                                            –
                                            <Input type="time" className="h-8 w-[6.5rem]" value={p.hora_fim} onChange={(e) => atualizar(i, 'hora_fim', e.target.value)} />
                                            <button type="button" aria-label="Remover período" className="p-1 text-red-500" onClick={() => setPeriodos((ps) => ps.filter((_, j) => j !== i))}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
                                        onClick={() => setPeriodos((ps) => [...ps, { dia_semana: dia, hora_inicio: doDia.length ? '14:00' : '08:00', hora_fim: doDia.length ? '18:00' : '12:00' }])}>
                                        <Plus className="h-3 w-3" /> período
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {porProfissional && (
                    <div className="space-y-1.5">
                        <Label>Quando o cliente falta</Label>
                        <select aria-label="Quando o cliente falta" className="h-10 w-full rounded-md border bg-white px-2 text-sm" value={faltaRegra}
                            onChange={(e) => setFaltaRegra(e.target.value)}>
                            <option value="">Seguir a regra da clínica</option>
                            <option value="PERGUNTAR">Perguntar na hora</option>
                            <option value="DESCONTAR">Descontar a sessão do pacote</option>
                            <option value="DEVOLVER">Devolver a sessão para o cliente</option>
                        </select>
                    </div>
                )}

                {admin && !ehAdmin && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={usaClinica} onChange={(e) => setUsaClinica(e.target.checked)} />
                        <span>
                            <span className="font-medium">Usa os serviços e técnicas da clínica</span>
                            <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                                Desmarcado, o profissional vê, vende e agenda só os serviços e técnicas que ele mesmo cadastrar.
                            </span>
                        </span>
                    </label>
                )}

                {admin && (usaClinica || ehAdmin) && (
                    <div className="space-y-1.5">
                        <Label>Serviços da clínica que executa <span className="font-normal text-[hsl(var(--muted-foreground))]">(nenhum marcado = todos)</span></Label>
                        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
                            {((servicosQ.data ?? []) as any[]).filter((s) => s.id_profissional == null).map((s) => {
                                const ativo = servicosSel.includes(s.id);
                                return (
                                    <button key={s.id} type="button"
                                        onClick={() => setServicosSel((sel) => (ativo ? sel.filter((x) => x !== s.id) : [...sel, s.id]))}
                                        className={cn('rounded-full border px-2.5 py-1 text-xs', ativo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                        {s.nome}{s.nome_modalidade && !s.nome.includes(s.nome_modalidade) ? ` · ${s.nome_modalidade}` : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
