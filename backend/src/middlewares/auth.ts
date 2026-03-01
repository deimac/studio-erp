import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export type JwtUsuarioPayload = {
    id: number;
    perfil: string;
};

declare global {
    namespace Express {
        interface Request {
            usuario?: JwtUsuarioPayload;
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token não informado' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUsuarioPayload;
        req.usuario = payload;
        return next();
    } catch {
        return res.status(401).json({ message: 'Token inválido' });
    }
}
