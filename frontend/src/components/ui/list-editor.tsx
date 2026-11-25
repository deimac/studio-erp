import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Edita uma lista de textos: adicionar, editar, remover e reordenar. */
export function ListEditor({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
    const [novo, setNovo] = useState('');

    function adicionar() {
        const texto = novo.trim();
        if (!texto) return;
        onChange([...value, texto]);
        setNovo('');
    }

    function mover(i: number, delta: number) {
        const j = i + delta;
        if (j < 0 || j >= value.length) return;
        const copia = [...value];
        [copia[i], copia[j]] = [copia[j], copia[i]];
        onChange(copia);
    }

    return (
        <div className="mt-1 space-y-2">
            {value.map((item, i) => (
                <div key={i} className="flex items-center gap-1">
                    <Input value={item} onChange={(e) => onChange(value.map((v, k) => (k === i ? e.target.value : v)))} />
                    <Button type="button" size="sm" variant="ghost" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" aria-label="Descer" onClick={() => mover(i, 1)} disabled={i === value.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" aria-label="Remover" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                        <X className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            ))}
            <div className="flex items-center gap-1">
                <Input
                    value={novo}
                    placeholder={placeholder ?? 'Novo item'}
                    onChange={(e) => setNovo(e.target.value)}
                    // Digitou e foi direto para Salvar (sem o +): o texto entra na lista do mesmo jeito
                    onBlur={adicionar}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={adicionar} aria-label="Adicionar item">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
