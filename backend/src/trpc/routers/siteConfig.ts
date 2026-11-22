import { z } from 'zod';
import { SITE_CONFIG_CHAVES, siteConfig } from '../../drizzle/schema';
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc';

export async function lerSiteConfig(db: any): Promise<Record<string, string>> {
    const rows: Array<{ chave: string; valor: string | null }> = await db.select().from(siteConfig);
    return Object.fromEntries(rows.filter((r) => r.valor).map((r) => [r.chave, r.valor as string]));
}

export const siteConfigRouter = createTRPCRouter({
    getAll: protectedProcedure.query(({ ctx }) => lerSiteConfig(ctx.db)),

    set: adminProcedure
        .input(z.object({ chave: z.enum(SITE_CONFIG_CHAVES), valor: z.string().nullable() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .insert(siteConfig)
                .values({ chave: input.chave, valor: input.valor })
                .onDuplicateKeyUpdate({ set: { valor: input.valor } });
            return { ok: true };
        }),
});
