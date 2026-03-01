import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { usuarios } from '../drizzle/schema';

export type AuthUsuario = {
    id: number;
    perfil: string;
};

export type Session = {
    id: number;
    perfil: 'ADMIN' | 'PROFISSIONAL';
    unidadeId: number;
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
            })
            .from(usuarios)
            .where(eq(usuarios.id, usuario.id))
            .limit(1);

        if (usuarioDb?.ativo) {
            session = {
                id: usuarioDb.id,
                perfil: usuarioDb.perfil,
                unidadeId: usuarioDb.id_unidade,
            };
        }
    }

    return { req, res, usuario, session, db };
}

export type Context = inferAsyncReturnType<typeof createContext>;
