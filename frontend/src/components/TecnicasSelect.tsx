import { useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';

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
    /** Se informado, quando não acha o nome digitado oferece "Adicionar" ali mesmo. Devolve o id novo. */
    onCriar?: (nome: string) => Promise<number>;
};

/**
 * Seleção múltipla compacta: mostra só os itens escolhidos; os demais ficam
 * numa busca que abre sob demanda (a lista completa ocupava o modal inteiro).
 */
export function SeletorBusca({ itens, value, onChange, rotuloEscolher = 'Escolher', placeholder = 'Buscar…', vazio = 'Nada encontrado.', detalhe, abertoInicial = false, fecharAoEscolher = false, onCriar }: Props) {
    const tecnicas = itens;
    const [aberto, setAberto] = useState(abertoInicial);
    const [busca, setBusca] = useState('');

    const escolhidas = tecnicas.filter((t) => value.includes(t.id));
    const termo = busca.trim().toLowerCase();
    const filtradas = tecnicas.filter((t) => !termo || t.nome.toLowerCase().includes(termo));
    const alternar = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    const [criando, setCriando] = useState(false);
    const nomeNovo = busca.trim().replace(/\s+/g, ' ');
    const podeCriar = !!onCriar && nomeNovo.length >= 2 && !tecnicas.some((t) => t.nome.trim().toLowerCase() === nomeNovo.toLowerCase());

    async function criar() {
        if (!onCriar || !podeCriar || criando) return;
        setCriando(true);
        try {
            const id = await onCriar(nomeNovo);
            if (id) onChange([...value, id]);
            setBusca('');
            if (fecharAoEscolher) setAberto(false);
        } catch {
            // quem cria já avisa o erro
        } finally {
            setCriando(false);
        }
    }

    return (
        <div className="space-y-2">
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
                <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                    {aberto ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {aberto ? 'Fechar' : escolhidas.length ? 'Adicionar' : rotuloEscolher}
                </button>
            </div>

            {aberto && (
                <div className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); criar(); } }}
                            className="h-10 w-full bg-transparent text-sm outline-none" />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {filtradas.map((t) => {
                            const marcada = value.includes(t.id);
                            return (
                                <li key={t.id}>
                                    <button type="button" onClick={() => { alternar(t.id); if (fecharAoEscolher && !marcada) { setAberto(false); setBusca(''); } }}
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
                        {filtradas.length === 0 && !podeCriar && <li className="px-3 py-3 text-sm text-[hsl(var(--muted-foreground))]">{vazio}</li>}
                        {podeCriar && (
                            <li className={cn(filtradas.length > 0 && 'border-t')}>
                                <button type="button" onClick={criar} disabled={criando}
                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] disabled:opacity-60">
                                    {criando ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Plus className="h-5 w-5 shrink-0" />}
                                    <span className="min-w-0 flex-1">Adicionar "{nomeNovo}"</span>
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** Técnicas do serviço. */
export function TecnicasSelect({ tecnicas, value, onChange }: { tecnicas: Item[]; value: number[]; onChange: (ids: number[]) => void }) {
    const utils = trpc.useUtils();
    const { toast } = useToast();
    const criarMut = trpc.tecnicas.create.useMutation();
    async function criar(nome: string) {
        try {
            const r = await criarMut.mutateAsync({ nome });
            await utils.tecnicas.list.invalidate();
            toast({ title: `Técnica "${nome}" adicionada`, variant: 'success' });
            return r.id ?? 0;
        } catch (e: any) {
            toast({ title: e.message, variant: 'error' });
            throw e;
        }
    }
    return (
        <SeletorBusca itens={tecnicas} value={value} onChange={onChange} onCriar={criar}
            rotuloEscolher={tecnicas.length ? 'Escolher técnicas' : 'Adicionar técnica'}
            placeholder={tecnicas.length ? 'Buscar ou adicionar técnica…' : 'Digite o nome da técnica…'}
            vazio={tecnicas.length ? 'Nenhuma técnica com esse nome.' : 'Nenhuma técnica ainda. Digite para adicionar.'} />
    );
}
