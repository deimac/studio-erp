import { useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TelefoneInput } from '@/components/TelefoneInput';

type Pessoa = { id: number; nome: string };

/**
 * Busca de cliente/fornecedor padrão dos modais: digita o nome, toca no resultado;
 * escolhido, mostra o nome com "trocar". Com `cadastrar`, oferece cadastrar o
 * cliente na hora (nome + telefone) quando não encontra.
 */
export function BuscaPessoa({
    pessoas,
    valor,
    nome,
    onChange,
    cadastrar = false,
    travado = false,
    placeholder = 'Buscar cliente pelo nome…',
}: {
    pessoas: Pessoa[] | undefined;
    valor: number | null;
    /** Nome do escolhido quando ele não está na lista (ex.: edição). */
    nome?: string;
    onChange: (id: number | null, nome: string) => void;
    cadastrar?: boolean;
    /** Não deixa trocar (ex.: editando). */
    travado?: boolean;
    placeholder?: string;
}) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [busca, setBusca] = useState('');
    const [novo, setNovo] = useState<{ nome: string; telefone: string } | null>(null);
    const nomeNovoRef = useRef<HTMLInputElement>(null);

    // Cadastro rápido: cursor no fim do nome para completar
    useEffect(() => {
        if (!novo) return;
        const el = nomeNovoRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }, [novo === null]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtradas = useMemo(() => {
        const q = busca.trim().toLowerCase();
        const lista = pessoas ?? [];
        return (q ? lista.filter((p) => p.nome.toLowerCase().includes(q)) : lista).slice(0, 8);
    }, [busca, pessoas]);

    const rapidoMut = trpc.agenda.clienteRapido.useMutation({
        onSuccess: (c: any) => {
            escolher(c.id, c.nome);
            setNovo(null);
            utils.pessoas.listClientes.invalidate();
            utils.pessoas.list.invalidate();
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function escolher(id: number | null, n = '') {
        setBusca('');
        onChange(id, n);
    }

    if (valor) {
        const nomeAtual = pessoas?.find((p) => p.id === valor)?.nome ?? nome ?? '';
        return (
            <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{nomeAtual}</span>
                {!travado && (
                    <button type="button" className="shrink-0 text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => escolher(null)}>trocar</button>
                )}
            </div>
        );
    }

    if (novo) {
        return (
            <div className="space-y-2 rounded-md border border-dashed p-3">
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Novo cliente</p>
                <Input ref={nomeNovoRef} placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
                <TelefoneInput value={novo.telefone} onChange={(v) => setNovo((c) => (c ? { ...c, telefone: v } : c))} />
                <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setNovo(null)}>Voltar</Button>
                    <Button type="button" size="sm" disabled={novo.nome.trim().length < 2 || rapidoMut.isPending}
                        onClick={() => rapidoMut.mutate({ nome: novo.nome.trim(), telefone: novo.telefone || undefined })}>
                        Cadastrar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <Input placeholder={placeholder} value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-[hsl(var(--card))] shadow-lg">
                    {filtradas.map((p) => (
                        <button key={p.id} type="button" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]" onClick={() => escolher(p.id, p.nome)}>
                            {p.nome}
                        </button>
                    ))}
                    {cadastrar ? (
                        <button type="button" className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
                            onClick={() => setNovo({ nome: busca, telefone: '' })}>
                            <UserPlus className="h-4 w-4" /> Cadastrar "{busca}"
                        </button>
                    ) : (
                        filtradas.length === 0 && <p className="px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))]">Ninguém encontrado.</p>
                    )}
                </div>
            )}
        </div>
    );
}
