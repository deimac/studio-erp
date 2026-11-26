import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CalendarPlus, Receipt, ShoppingCart, UserPlus, type LucideIcon } from 'lucide-react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { AgendamentoForm } from '@/components/agenda/AgendamentoForm';
import { VendaForm } from '@/components/VendaForm';
import { PessoaForm } from '@/components/PessoaForm';
import { ReceitaDespesaForm } from '@/components/ReceitaDespesaForm';
import { dataISO } from '@/lib/agenda';
import { cn } from '@/lib/utils';

/**
 * Botão + do rodapé (celular): painel que sobe de baixo com
 * "Nesta tela" (ações que a página aberta registra) e "Criar" (atalhos gerais).
 */

export type AcaoRapida = {
    id: string;
    label: string;
    icone: LucideIcon;
    onSelect: () => void;
    disabled?: boolean;
};

export type FormGlobal = 'agendamento' | 'venda' | 'pessoa' | 'lancamento';

type Ctx = {
    abrirPainel: () => void;
    /** Abre um dos formulários gerais (novo agendamento, venda, cliente, lançamento). */
    abrirForm: (f: FormGlobal) => void;
    registrar: (ref: RefObject<AcaoRapida[]>) => void;
    remover: (ref: RefObject<AcaoRapida[]>) => void;
};

const AcoesCtx = createContext<Ctx | null>(null);

export function useAcoesRapidas() {
    const ctx = useContext(AcoesCtx);
    if (!ctx) throw new Error('useAcoesRapidas fora do AcoesRapidasProvider');
    return ctx;
}

/** A página informa as ações dela para o painel do +. Saem quando a página fecha. */
export function useAcoesDaTela(acoes: AcaoRapida[]) {
    const ctx = useContext(AcoesCtx);
    const ref = useRef(acoes);
    ref.current = acoes;
    useEffect(() => {
        if (!ctx) return;
        ctx.registrar(ref);
        return () => ctx.remover(ref);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

const CRIAR: { id: FormGlobal; label: string; icone: LucideIcon }[] = [
    { id: 'agendamento', label: 'Novo agendamento', icone: CalendarPlus },
    { id: 'venda', label: 'Nova venda', icone: ShoppingCart },
    { id: 'pessoa', label: 'Novo cliente', icone: UserPlus },
    { id: 'lancamento', label: 'Receita ou despesa', icone: Receipt },
];

export function AcoesRapidasProvider({ children }: { children: ReactNode }) {
    const [painel, setPainel] = useState(false);
    const [form, setForm] = useState<FormGlobal | null>(null);
    const telaRef = useRef<RefObject<AcaoRapida[]> | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const utils = trpc.useUtils();

    const registrar = useCallback((ref: RefObject<AcaoRapida[]>) => { telaRef.current = ref; }, []);
    const remover = useCallback((ref: RefObject<AcaoRapida[]>) => {
        if (telaRef.current === ref) telaRef.current = null;
    }, []);
    const abrirPainel = useCallback(() => setPainel(true), []);
    const ctx = useMemo(() => ({ abrirPainel, abrirForm: setForm, registrar, remover }), [abrirPainel, registrar, remover]);

    const daTela = painel ? (telaRef.current?.current ?? []) : [];
    const criar = CRIAR.filter((c) => !daTela.some((a) => a.id === c.id));

    // Fecha o painel antes de abrir a janela, para não empilhar duas folhas
    const escolher = (f: () => void) => {
        setPainel(false);
        setTimeout(f, 150);
    };
    const fechaForm = (v: boolean) => { if (!v) setForm(null); };

    return (
        <AcoesCtx.Provider value={ctx}>
            {children}

            <DialogPrimitive.Root open={painel} onOpenChange={setPainel}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fundo-folha fixed inset-0 z-50 bg-[hsl(var(--overlay)/0.45)]" />
                    <Folha onFechar={() => setPainel(false)}>
                        {daTela.length > 0 && (
                            <section className="mb-4">
                                <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Nesta tela</h3>
                                <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))]">
                                    {daTela.map((a) => (
                                        <li key={a.id}>
                                            <button type="button" disabled={a.disabled} onClick={() => escolher(a.onSelect)}
                                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium active:bg-[hsl(var(--accent))] disabled:opacity-40">
                                                <a.icone className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" />
                                                {a.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                        <section>
                            <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Criar</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {criar.map((c) => (
                                    <button key={c.id} type="button" onClick={() => escolher(() => setForm(c.id))}
                                        className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-2 py-4 text-center text-sm font-medium active:bg-[hsl(var(--accent))]">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                                            <c.icone className="h-5 w-5 text-[hsl(var(--primary))]" />
                                        </span>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </Folha>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>

            {form === 'agendamento' && (
                <AgendamentoForm open onOpenChange={fechaForm} inicial={{ data: dataISO(new Date()), id_profissional: user?.id }} />
            )}
            {form === 'venda' && (
                <VendaForm open onOpenChange={fechaForm} onSuccess={() => {
                    utils.vendas.invalidate();
                    utils.financeiro.invalidate();
                    toast({ title: 'Venda lançada!', variant: 'success' });
                }} />
            )}
            {form === 'pessoa' && (
                <PessoaForm open onOpenChange={fechaForm} onSuccess={() => {
                    utils.pessoas.invalidate();
                    toast({ title: 'Pessoa criada!', variant: 'success' });
                }} />
            )}
            {form === 'lancamento' && (
                <ReceitaDespesaForm open onOpenChange={fechaForm} onSuccess={() => {
                    utils.financeiro.invalidate();
                    utils.receitasDespesas.invalidate();
                    toast({ title: 'Lançamento salvo', variant: 'success' });
                }} />
            )}
        </AcoesCtx.Provider>
    );
}

/** Folha do painel: arrastar a alça (ou o topo) para baixo fecha. */
function Folha({ children, onFechar }: { children: ReactNode; onFechar: () => void }) {
    const [dy, setDy] = useState(0);
    const inicio = useRef<number | null>(null);

    const arrastar = {
        onPointerDown: (e: React.PointerEvent) => { inicio.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId); },
        onPointerMove: (e: React.PointerEvent) => { if (inicio.current !== null) setDy(Math.max(0, e.clientY - inicio.current)); },
        onPointerUp: () => {
            if (dy > 80) onFechar();
            inicio.current = null;
            setDy(0);
        },
        onPointerCancel: () => { inicio.current = null; setDy(0); },
    };

    return (
        <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: inicio.current === null ? 'transform 150ms' : undefined }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg folha lg:mx-auto lg:max-w-md"
        >
            <div {...arrastar} className={cn('-mx-4 mb-2 cursor-grab touch-none px-4 pb-2 pt-3')}>
                <div className="mx-auto h-1.5 w-10 rounded-full bg-[hsl(var(--border))]" />
                <DialogPrimitive.Title className="mt-3 text-center text-base font-semibold">O que você quer fazer?</DialogPrimitive.Title>
            </div>
            {children}
        </DialogPrimitive.Content>
    );
}
