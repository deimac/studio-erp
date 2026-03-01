import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { usuarios } from '../../drizzle/schema';
import { TRPCError } from '@trpc/server';
import { adminProcedure, createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';

export const usuariosRouter = createTRPCRouter({
    login: publicProcedure
        .input(
            z.object({
                email: z.string().email(),
                senha: z.string().min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [usuarioDb] = await ctx.db
                .select()
                .from(usuarios)
                .where(eq(usuarios.email, input.email))
                .limit(1);

            if (!usuarioDb) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            if (!usuarioDb.ativo) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário inativo' });
            }

            const senhaValida = await bcrypt.compare(input.senha, usuarioDb.senha);
            if (!senhaValida) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha incorreta' });
            }

            const token = jwt.sign(
                { id: usuarioDb.id, perfil: usuarioDb.perfil },
                process.env.JWT_SECRET as string,
                { expiresIn: '8h' },
            );

            return {
                token,
                usuario: {
                    id: usuarioDb.id,
                    nome: usuarioDb.nome,
                    email: usuarioDb.email,
                    perfil: usuarioDb.perfil,
                    id_unidade: usuarioDb.id_unidade,
                },
            };
        }),

    me: protectedProcedure.query(async ({ ctx }) => {
        const [usuarioDb] = await ctx.db
            .select({
                id: usuarios.id,
                nome: usuarios.nome,
                email: usuarios.email,
                perfil: usuarios.perfil,
                id_unidade: usuarios.id_unidade,
                ativo: usuarios.ativo,
            })
            .from(usuarios)
            .where(eq(usuarios.id, ctx.session.id))
            .limit(1);

        if (!usuarioDb) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }

        return usuarioDb;
    }),

    list: adminProcedure.query(async ({ ctx }) => {
        return ctx.db
            .select({
                id: usuarios.id,
                nome: usuarios.nome,
                email: usuarios.email,
                perfil: usuarios.perfil,
                id_unidade: usuarios.id_unidade,
                ativo: usuarios.ativo,
                created_at: usuarios.created_at,
                updated_at: usuarios.updated_at,
            })
            .from(usuarios)
            .where(eq(usuarios.id_unidade, ctx.session.unidadeId));
    }),

    createProfissional: adminProcedure
        .input(
            z.object({
                nome: z.string().min(2),
                email: z.string().email(),
                senha: z.string().min(6),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [existente] = await ctx.db
                .select({ id: usuarios.id })
                .from(usuarios)
                .where(eq(usuarios.email, input.email))
                .limit(1);

            if (existente) {
                throw new TRPCError({ code: 'CONFLICT', message: 'Email já cadastrado' });
            }

            const senhaHash = await bcrypt.hash(input.senha, 10);
            const ids = await ctx.db
                .insert(usuarios)
                .values({
                    nome: input.nome,
                    email: input.email,
                    senha: senhaHash,
                    perfil: 'PROFISSIONAL',
                    id_unidade: ctx.session.unidadeId,
                    ativo: true,
                })
                .$returningId();

            return { id: ids[0]?.id };
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                nome: z.string().min(2).optional(),
                email: z.string().email().optional(),
                perfil: z.enum(['ADMIN', 'PROFISSIONAL']).optional(),
                ativo: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [usuarioDb] = await ctx.db
                .select({ id: usuarios.id, id_unidade: usuarios.id_unidade })
                .from(usuarios)
                .where(eq(usuarios.id, input.id))
                .limit(1);

            if (!usuarioDb) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }
            if (usuarioDb.id_unidade !== ctx.session.unidadeId) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário de outra unidade' });
            }

            await ctx.db
                .update(usuarios)
                .set({
                    ...(input.nome ? { nome: input.nome } : {}),
                    ...(input.email ? { email: input.email } : {}),
                    ...(input.perfil ? { perfil: input.perfil } : {}),
                    ...(typeof input.ativo === 'boolean' ? { ativo: input.ativo } : {}),
                    updated_at: new Date(),
                })
                .where(eq(usuarios.id, input.id));

            return { ok: true };
        }),

    changeMyPassword: protectedProcedure
        .input(
            z.object({
                senhaAtual: z.string().min(1),
                novaSenha: z.string().min(6),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [usuarioDb] = await ctx.db
                .select({ id: usuarios.id, senha: usuarios.senha })
                .from(usuarios)
                .where(eq(usuarios.id, ctx.session.id))
                .limit(1);

            if (!usuarioDb) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            const ok = await bcrypt.compare(input.senhaAtual, usuarioDb.senha);
            if (!ok) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' });
            }

            const senhaHash = await bcrypt.hash(input.novaSenha, 10);
            await ctx.db
                .update(usuarios)
                .set({ senha: senhaHash, updated_at: new Date() })
                .where(eq(usuarios.id, ctx.session.id));

            return { ok: true };
        }),
});
