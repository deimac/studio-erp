import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NOME_APARELHO, PASSOS, type Aparelho } from '@/lib/instalar';
import { InstallArt } from './InstallArt';

// Roteiro ilustrado: o do aparelho da pessoa e um botão para ver o outro.
export function InstallGuide({ aparelhoInicial, nome }: { aparelhoInicial: Aparelho; nome: string }) {
    const [aparelho, setAparelho] = useState<Aparelho>(aparelhoInicial);
    const outro: Aparelho = aparelho === 'ios' ? 'android' : 'ios';
    const host = typeof window === 'undefined' ? '' : window.location.host;

    return (
        <section aria-label={`Como instalar no ${NOME_APARELHO[aparelho]}`} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Como instalar no {NOME_APARELHO[aparelho]}</h2>
                <Button variant="ghost" size="sm" onClick={() => setAparelho(outro)}>
                    Ver no {NOME_APARELHO[outro]}
                </Button>
            </div>
            <ol className="space-y-4">
                {PASSOS[aparelho].map((passo, i) => (
                    <li key={passo.id} className="overflow-hidden rounded-xl border bg-[hsl(var(--card))]">
                        <div className="flex items-start gap-3 p-4 pb-2">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                                {i + 1}
                            </span>
                            <div className="min-w-0">
                                <p className="font-medium">{passo.titulo}</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{passo.texto}</p>
                            </div>
                        </div>
                        <div className="px-4 pb-4">
                            <InstallArt arte={passo.arte} nome={nome} host={host} />
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
