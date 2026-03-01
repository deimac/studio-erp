import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.session) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Não autorizado' });
    }

    return next({
        ctx: {
            ...ctx,
            session: ctx.session,
        },
    });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.session.perfil !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito ao ADMIN' });
    }
    return next();
});

/** Admin also has access to profissional endpoints. */
export const profissionalProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.session.perfil !== 'PROFISSIONAL' && ctx.session.perfil !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito ao PROFISSIONAL ou ADMIN' });
    }
    return next();
});
