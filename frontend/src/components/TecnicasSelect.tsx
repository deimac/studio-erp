import { useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tecnica = { id: number; nome: string };

/**
 * Técnicas do serviço: mostra só as escolhidas; as demais ficam numa busca
 * que abre sob demanda (a lista completa ocupava o modal inteiro).
 */
export function TecnicasSelect({ tecnicas, value, onChange }: { tecnicas: Tecnica[]; value: number[]; onChange: (ids: number[]) => void }) {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');

    const escolhidas = tecnicas.filter((t) => value.includes(t.id));
    const termo = busca.trim().toLowerCase();
    const filtradas = tecnicas.filter((t) => !termo || t.nome.toLowerCase().includes(termo));
    const alternar = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {escolhidas.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--primary))]/10 py-1 pl-3 pr-1 text-sm text-[hsl(var(--primary))]">
                        {t.nome}
                        <button type="button" aria-label={`Tirar ${t.nome}`} onClick={() => alternar(t.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[hsl(var(--primary))]/15">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </span>
                ))}
                <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                    {aberto ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {aberto ? 'Fechar' : escolhidas.length ? 'Adicionar' : 'Escolher técnicas'}
                </button>
            </div>

            {aberto && (
                <div className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar técnica…"
                            className="h-10 w-full bg-transparent text-sm outline-none" />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {filtradas.map((t) => {
                            const marcada = value.includes(t.id);
                            return (
                                <li key={t.id}>
                                    <button type="button" onClick={() => alternar(t.id)}
                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]">
                                        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                                            marcada && 'border-transparent bg-[hsl(var(--primary))] text-white')}>
                                            {marcada && <Check className="h-3.5 w-3.5" />}
                                        </span>
                                        {t.nome}
                                    </button>
                                </li>
                            );
                        })}
                        {filtradas.length === 0 && <li className="px-3 py-3 text-sm text-[hsl(var(--muted-foreground))]">Nenhuma técnica com esse nome.</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
