import { CheckCircle, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InstallGuide } from '@/components/instalar/InstallGuide';
import { usePWA } from '@/hooks/usePWA';
import { APP_NOME } from '@/lib/instalar';

const VANTAGENS = [
    'Abre direto da tela do celular, como um aplicativo',
    'Tela cheia, sem a barra do navegador',
    'Agenda, clientes e vendas a um toque',
];

// Página pública (não precisa entrar): explica como instalar o app no iPhone e no Android.
export default function Instalar() {
    const { instalado, podeInstalar, isIOS, instalar } = usePWA();
    const navigate = useNavigate();
    const voltar = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

    if (instalado) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
                <div className="w-full max-w-md rounded-xl border bg-[hsl(var(--card))] p-8 text-center">
                    <CheckCircle className="mx-auto mb-4 h-16 w-16 text-[hsl(var(--success))]" />
                    <h1 className="mb-2 text-2xl font-bold">App instalado!</h1>
                    <p className="mb-6 text-[hsl(var(--muted-foreground))]">O {APP_NOME} já está na tela do seu celular.</p>
                    <Button className="w-full" onClick={() => navigate('/')}>Abrir o {APP_NOME}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <div className="mx-auto max-w-md space-y-6">
                <header className="py-6 text-center">
                    <img src="/icons/icon-192.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-md" />
                    <h1 className="mb-2 text-2xl font-bold">Instalar o {APP_NOME} no celular</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">Leva menos de um minuto e não precisa de loja de aplicativos.</p>
                </header>

                <ul className="space-y-3">
                    {VANTAGENS.map((v) => (
                        <li key={v} className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--card))] p-4">
                            <CheckCircle className="h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
                            <span className="text-sm">{v}</span>
                        </li>
                    ))}
                </ul>

                {podeInstalar && (
                    <Button onClick={instalar} size="lg" className="h-12 w-full text-base">
                        <Download className="mr-2 h-5 w-5" />
                        Instalar agora
                    </Button>
                )}

                <InstallGuide aparelhoInicial={isIOS ? 'ios' : 'android'} nome={APP_NOME} />

                <Button variant="outline" className="w-full" onClick={voltar}>
                    Voltar
                </Button>
            </div>
        </div>
    );
}
