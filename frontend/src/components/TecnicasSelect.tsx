import { useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Item = { id: number; nome: string };

type Props = {
    itens: Item[];
    value: number[];
    onChange: (ids: number[]) => void;
    /** Texto do botão quando nada foi escolhido. */
    rotuloEscolher?: string;
    placeholder?: string;
    vazio?: string;
    /** Informação curta ao lado do nome (ex.: "60 min"). */
    detalhe?: (item: Item) => string | undefined;
    /** Abre a busca já de início (ex.: nada escolhido ainda). */
    abertoInicial?: boolean;
    /** Fecha a busca depois de escolher um item (quando o comum é escolher só um). */
    fecharAoEscolher?: boolean;
    /** Cadastro de um item que não está na lista: abre os campos ali mesmo... */
    formNovo?: (p: { nome: string; voltar: () => void; criado: (id: number) => void }) => React.ReactNode;
    /** ...ou fora (ex.: painel lateral), recebendo o nome digitado. */
    onNovo?: (nome: string) => void;
};

/**
 * Seleção múltipla compacta: mostra só os itens escolhidos; os demais ficam
 * numa busca que abre sob demanda. Não achou? "Cadastrar" no fim da lista.
 */
export function SeletorBusca({ itens, value, onChange, rotuloEscolher = 'Escolher', placeholder = 'Buscar…', vazio = 'Nada encontrado.', detalhe, abertoInicial = false, fecharAoEscolher = false, formNovo, onNovo }: Props) {
    const [aberto, setAberto] = useState(abertoInicial);
    const [busca, setBusca] = useState('');
    const [novo, setNovo] = useState<string | null>(null);

    const escolhidas = value.map((id) => itens.find((t) => t.id === id)).filter((t): t is Item => !!t);
    const termo = busca.trim().toLowerCase();
    const filtradas = itens.filter((t) => !termo || t.nome.toLowerCase().includes(termo));
    const alternar = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    const fechar = () => { setAberto(false); setBusca(''); setNovo(null); };

    const nomeDigitado = busca.trim().replace(/\s+/g, ' ');
    const podeCadastrar = (!!formNovo || !!onNovo) && !itens.some((t) => t.nome.trim().toLowerCase() === nomeDigitado.toLowerCase());
    function cadastrar() {
        if (onNovo) { onNovo(nomeDigitado); fechar(); }
        else setNovo(nomeDigitado);
    }

    return (
        <div className="space-y-2">
            {(escolhidas.length > 0 || !aberto) && (
                <div className="flex flex-wrap items-center gap-2">
                    {escolhidas.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 py-1 pl-3 pr-1 text-sm text-[hsl(var(--primary))]">
                            {t.nome}
                            {detalhe?.(t) && <span className="opacity-70">· {detalhe(t)}</span>}
                            <button type="button" aria-label={`Tirar ${t.nome}`} onClick={() => alternar(t.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[hsl(var(--primary))]/15">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    ))}
                    {!aberto && (
                        <button type="button" onClick={() => setAberto(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                            <Plus className="h-4 w-4" />
                            {escolhidas.length ? 'Adicionar' : rotuloEscolher}
                        </button>
                    )}
                </div>
            )}

            {aberto && novo !== null && formNovo?.({
                nome: novo,
                voltar: () => setNovo(null),
                criado: (id) => { onChange([...value, id]); setNovo(null); setBusca(''); if (fecharAoEscolher) setAberto(false); },
            })}

            {aberto && novo === null && (
                <div className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            className="h-10 w-full bg-transparent text-sm outline-none" />
                        <button type="button" aria-label="Fechar busca" onClick={fechar} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {filtradas.map((t) => {
                            const marcada = value.includes(t.id);
                            return (
                                <li key={t.id}>
                                    <button type="button" onClick={() => { alternar(t.id); if (fecharAoEscolher && !marcada) fechar(); }}
                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]">
                                        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                                            marcada && 'border-transparent bg-[hsl(var(--primary))] text-white')}>
                                            {marcada && <Check className="h-3.5 w-3.5" />}
                                        </span>
                                        <span className="min-w-0 flex-1">{t.nome}</span>
                                        {detalhe?.(t) && <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{detalhe(t)}</span>}
                                    </button>
                                </li>
                            );
                        })}
                        {filtradas.length === 0 && <li className="px-3 py-3 text-sm text-[hsl(var(--muted-foreground))]">{vazio}</li>}
                        {podeCadastrar && (
                            <li className="border-t">
                                <button type="button" onClick={cadastrar}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]">
                                    <Plus className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1">{nomeDigitado ? `Cadastrar "${nomeDigitado}"` : 'Cadastrar novo'}</span>
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** Campos da técnica nova (só o nome), no mesmo lugar da busca. */
function NovaTecnica({ nome, voltar, criado }: { nome: string; voltar: () => void; criado: (id: number) => void }) {
    const utils = trpc.useUtils();
    const { toast } = useToast();
    const [valor, setValor] = useState(nome);
    const criarMut = trpc.tecnicas.create.useMutation({
        onSuccess: async (r: { id?: number }) => {
            await utils.tecnicas.list.invalidate();
            toast({ title: 'Técnica cadastrada', variant: 'success' });
            if (r.id) criado(r.id);
        },
        onError: (e: any) => toast({ title: e.message, variant: 'error' }),
    });
    const salvar = () => { if (valor.trim().length >= 2) criarMut.mutate({ nome: valor.trim() }); };
    return (
        <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Nova técnica</p>
            <Input autoFocus placeholder="Nome da técnica" value={valor} onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } }} />
            <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={voltar}>Voltar</Button>
                <Button type="button" size="sm" disabled={valor.trim().length < 2 || criarMut.isPending} onClick={salvar}>
                    {criarMut.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
            </div>
        </div>
    );
}

/** Técnicas do serviço. */
export function TecnicasSelect({ tecnicas, value, onChange }: { tecnicas: Item[]; value: number[]; onChange: (ids: number[]) => void }) {
    return (
        <SeletorBusca itens={tecnicas} value={value} onChange={onChange}
            rotuloEscolher={tecnicas.length ? 'Escolher técnicas' : 'Adicionar técnica'}
            placeholder="Buscar técnica…"
            vazio={tecnicas.length ? 'Nenhuma técnica com esse nome.' : 'Nenhuma técnica cadastrada ainda.'}
            formNovo={(p) => <NovaTecnica {...p} />} />
    );
}
