import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { unidades, usuarios } from '../drizzle/schema';

export type AuthUsuario = {
    id: number;
    perfil: string;
};

export type Session = {
    id: number;
    perfil: 'ADMIN' | 'PROFISSIONAL' | 'ESPECTADOR';
    unidadeId: number;
    /** Usa os serviços/técnicas da clínica (admin: sempre). */
    veServicosClinica: boolean;
    /**
     * Vê e mexe nos dados dos outros profissionais (vendas, clientes, financeiro, agenda).
     * Só o admin no modo "Clínica". No modo "cada um cuida do seu", o admin vê só o dele
     * (mais os registros sem dono), mas continua administrando o sistema.
     */
    veTudo: boolean;
};

export async function createContext({ req, res }: CreateExpressContextOptions) {
    const token = req.headers.authorization?.replace('Bearer ', '').trim();
    let usuario: AuthUsuario | null = null;

    let session: Session | null = null;

    if (token) {
        try {
            usuario = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUsuario;
        } catch {
            usuario = null;
        }
    }

    if (usuario?.id) {
        const [usuarioDb] = await db
            .select({
                id: usuarios.id,
                perfil: usuarios.perfil,
                id_unidade: usuarios.id_unidade,
                ativo: usuarios.ativo,
                modo_trabalho: unidades.modo_trabalho,
            })
            .from(usuarios)
            .leftJoin(unidades, eq(unidades.id, usuarios.id_unidade))
            .where(eq(usuarios.id, usuario.id))
            .limit(1);

        if (usuarioDb?.ativo) {
            session = {
                id: usuarioDb.id,
                perfil: usuarioDb.perfil,
                unidadeId: usuarioDb.id_unidade,
                // Modo Admin (CLINICA): todos usam os serviços da clínica. Cada um cuida do seu: só o admin.
                veServicosClinica: usuarioDb.perfil !== 'PROFISSIONAL' || usuarioDb.modo_trabalho !== 'INDIVIDUAL',
                veTudo: usuarioDb.perfil === 'ADMIN' && usuarioDb.modo_trabalho !== 'INDIVIDUAL',
            };
        }
    }

    return { req, res, usuario, session, db };
}

export type Context = inferAsyncReturnType<typeof createContext>;
