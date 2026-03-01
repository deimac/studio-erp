import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Login() {
    const { token, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');

    const loginMutation = trpc.usuarios.login.useMutation({
        onSuccess(data) {
            login(data.token, data.usuario as any);
            navigate('/dashboard', { replace: true });
        },
        onError(err) {
            setError(err.message);
        },
    });

    if (token) return <Navigate to="/dashboard" replace />;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        loginMutation.mutate({ email, senha });
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-[hsl(var(--background))] px-4">
            <Card className="w-full max-w-sm shadow-xl">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Studio ERP</CardTitle>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Faça login para continuar</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@studio.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="senha">Senha</Label>
                            <Input
                                id="senha"
                                type="password"
                                placeholder="••••••"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                required
                            />
                        </div>
                        {error && (
                            <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
                        )}
                        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
