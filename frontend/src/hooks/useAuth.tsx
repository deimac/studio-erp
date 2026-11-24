import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { trpc } from '@/services/trpc';

export type AuthUser = {
    id: number;
    nome?: string;
    email: string;
    perfil: 'ADMIN' | 'PROFISSIONAL';
    id_unidade: number;
};

type AuthContextValue = {
    token: string | null;
    user: AuthUser | null;
    isAdmin: boolean;
    isProfissional: boolean;
    /**
     * Vê e mexe nos dados dos outros profissionais: só o admin no modo "Clínica".
     * No modo "cada um cuida do seu", o admin continua administrando, mas vê só o dele.
     */
    veTudo: boolean;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'studio_erp_token';
const USER_KEY = 'studio_erp_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState<AuthUser | null>(() => {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    });

    const login = useCallback((newToken: string, newUser: AuthUser) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // O modo de trabalho pode mudar em Configurações: vem sempre do servidor
    const ehAdmin = user?.perfil === 'ADMIN';
    const meQ = trpc.usuarios.me.useQuery(undefined, { enabled: !!token && ehAdmin, staleTime: 5 * 60_000 });
    const veTudo = ehAdmin && Boolean((meQ.data as { ve_tudo?: boolean } | undefined)?.ve_tudo);

    // Auto-logout if token disappears from another tab
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === TOKEN_KEY && !e.newValue) logout();
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [logout]);

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                isAdmin: ehAdmin,
                isProfissional: user?.perfil === 'PROFISSIONAL',
                veTudo,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
    return ctx;
}
