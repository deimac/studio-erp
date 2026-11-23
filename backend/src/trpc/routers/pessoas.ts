import { TRPCError } from '@trpc/server';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { pessoaProfissionais, pessoas, vendas } from '../../drizzle/schema';
import { filtroDono, zEscopo } from '../../lib/escopo';
import { assertAcessoPessoa, pessoaDoProfissional, vincularPessoa } from '../acesso';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const pessoasRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                tipo: z.enum(['CLIENTE', 'FORNECEDOR', 'AMBOS']).optional(),
                status: z.enum(['ATIVO', 'INATIVO']).optional(),
                search: z.string().optional(),
                escopo: zEscopo,
            }).optional(),
        )
        .query(async ({ ctx, input }) => {
            const whereParts: any[] = [
                eq(pessoas.id_unidade, ctx.session.unidadeId),
                isNull(pessoas.deleted_at),
            ];
            // Profissional só vê as pessoas que atende; admin escolhe Geral / Só meu
            const dono = filtroDono(ctx.session, input?.escopo);
            if (dono != null) whereParts.push(pessoaDoProfissional(dono));
            if (input?.tipo) whereParts.push(eq(pessoas.tipo, input.tipo));
            if (input?.status) whereParts.push(eq(pessoas.status, input.status));
            if (input?.search) {
                const term = `%${input.search}%`;
                whereParts.push(
                    or(
                        like(pessoas.nome, term),
                        like(pessoas.email, term),
                        like(pessoas.cpf_cnpj, term),
                        like(pessoas.telefone, term),
                    ),
                );
            }

            return ctx.db
                .select()
                .from(pessoas)
                .where(and(...whereParts))
                .orderBy(pessoas.nome);
        }),

    /** Lista simplificada para selects (clientes ativos). */
    listClientes: protectedProcedure
        .input(z.object({ escopo: zEscopo }).optional())
        .query(async ({ ctx, input }) => {
            const dono = filtroDono(ctx.session, input?.escopo);
            return ctx.db
                .select({ id: pessoas.id, nome: pessoas.nome })
                .from(pessoas)
                .where(
                    and(
                        eq(pessoas.id_unidade, ctx.session.unidadeId),
                        isNull(pessoas.deleted_at),
                        eq(pessoas.status, 'ATIVO'),
                        or(eq(pessoas.tipo, 'CLIENTE'), eq(pessoas.tipo, 'AMBOS')),
                        dono != null ? pessoaDoProfissional(dono) : undefined,
                    ),
                )
                .orderBy(pessoas.nome);
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ ctx, input }) => {
            await assertAcessoPessoa(ctx.db, ctx.session, input.id);
            const [row] = await ctx.db
                .select()
                .from(pessoas)
                .where(
                    and(
                        eq(pessoas.id, input.id),
                        eq(pessoas.id_unidade, ctx.session.unidadeId),
                        isNull(pessoas.deleted_at),
                    ),
                )
                .limit(1);
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pessoa não encontrada' });
            return row;
        }),

    /**
     * Cria a pessoa e vincula ao usuário. Se o CPF/CNPJ já existe na unidade,
     * apenas vincula a pessoa existente ao profissional (sem duplicar).
     */
    create: protectedProcedure
        .input(
            z.object({
                tipo: z.enum(['CLIENTE', 'FORNECEDOR', 'AMBOS']),
                nome: z.string().min(1).max(150),
                cpf_cnpj: z.string().max(18).optional(),
                telefone: z.string().max(20).optional(),
                email: z.string().max(150).optional(),
                data_nascimento: z.string().optional(),
                observacao: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const doc = input.cpf_cnpj?.trim();
            if (doc) {
                const [existente] = await ctx.db
                    .select({ id: pessoas.id })
                    .from(pessoas)
                    .where(and(eq(pessoas.cpf_cnpj, doc), eq(pessoas.id_unidade, ctx.session.unidadeId), isNull(pessoas.deleted_at)))
                    .limit(1);
                if (existente) {
                    await vincularPessoa(ctx.db, existente.id, ctx.session.id);
                    return { id: existente.id, existente: true };
                }
            }
            const ids = await ctx.db.insert(pessoas).values({
                id_unidade: ctx.session.unidadeId,
                tipo: input.tipo,
                nome: input.nome,
                cpf_cnpj: input.cpf_cnpj || null,
                telefone: input.telefone || null,
                email: input.email || null,
                data_nascimento: input.data_nascimento ? new Date(input.data_nascimento) : null,
                observacao: input.observacao || null,
                status: 'ATIVO',
            }).$returningId();
            const id = ids[0]!.id;
            await vincularPessoa(ctx.db, id, ctx.session.id);
            return { id, existente: false };
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.number().int().positive(),
                tipo: z.enum(['CLIENTE', 'FORNECEDOR', 'AMBOS']).optional(),
                nome: z.string().min(1).max(150).optional(),
                cpf_cnpj: z.string().max(18).optional().nullable(),
                telefone: z.string().max(20).optional().nullable(),
                email: z.string().max(150).optional().nullable(),
                data_nascimento: z.string().optional().nullable(),
                observacao: z.string().optional().nullable(),
                status: z.enum(['ATIVO', 'INATIVO']).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            await assertAcessoPessoa(ctx.db, ctx.session, input.id);

            const set: Record<string, any> = { updated_at: new Date() };
            if (input.tipo !== undefined) set.tipo = input.tipo;
            if (input.nome !== undefined) set.nome = input.nome;
            if (input.cpf_cnpj !== undefined) set.cpf_cnpj = input.cpf_cnpj;
            if (input.telefone !== undefined) set.telefone = input.telefone;
            if (input.email !== undefined) set.email = input.email;
            if (input.data_nascimento !== undefined)
                set.data_nascimento = input.data_nascimento ? new Date(input.data_nascimento) : null;
            if (input.observacao !== undefined) set.observacao = input.observacao;
            if (input.status !== undefined) set.status = input.status;

            await ctx.db.update(pessoas).set(set).where(eq(pessoas.id, input.id));
            return { ok: true };
        }),

    /**
     * Profissional: se outros profissionais também atendem a pessoa, só remove o
     * vínculo dele; senão exclui. Admin: exclui para todos.
     */
    delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ ctx, input }) => {
            await assertAcessoPessoa(ctx.db, ctx.session, input.id);

            if (ctx.session.perfil !== 'ADMIN') {
                const vinculos = await ctx.db
                    .select({ id: pessoaProfissionais.id_profissional })
                    .from(pessoaProfissionais)
                    .where(eq(pessoaProfissionais.id_pessoa, input.id));
                if (vinculos.some((v) => v.id !== ctx.session.id)) {
                    const [minhaVenda] = await ctx.db
                        .select({ id: vendas.id })
                        .from(vendas)
                        .where(and(eq(vendas.id_pessoa, input.id), eq(vendas.id_profissional, ctx.session.id), isNull(vendas.deleted_at)))
                        .limit(1);
                    if (minhaVenda)
                        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível excluir: existem vendas suas para esta pessoa.' });
                    await ctx.db
                        .delete(pessoaProfissionais)
                        .where(and(eq(pessoaProfissionais.id_pessoa, input.id), eq(pessoaProfissionais.id_profissional, ctx.session.id)));
                    return { ok: true, apenasDesvinculado: true };
                }
            }

            // Check for linked vendas
            const vendaCountRes = await ctx.db
                .select({ count: sql`COUNT(*)` })
                .from(vendas)
                .where(and(
                    eq(vendas.id_pessoa, input.id),
                    isNull(vendas.deleted_at)
                ));
            const vendaCount = (vendaCountRes[0] as { count: number })?.count ?? 0;
            if (vendaCount > 0) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível excluir: existem vendas vinculadas a esta pessoa.' });
            }

            // Soft delete
            await ctx.db
                .update(pessoas)
                .set({ deleted_at: new Date(), updated_at: new Date() })
                .where(eq(pessoas.id, input.id));
            return { ok: true };
        }),
});
