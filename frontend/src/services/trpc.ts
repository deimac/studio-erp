import { createTRPCReact } from '@trpc/react-query';
// Importa o tipo do AppRouter do backend para obter type-safety no client.
import type { AppRouter } from '@backend/app';

export const trpc = createTRPCReact<AppRouter>();

// Mutation para remover parcela filha
// Exemplo de uso: trpc.vendas.removerParcelaFilha.useMutation()
