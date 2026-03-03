import { createTRPCReact } from '@trpc/react-query';

// Cliente tRPC
// Nota: Para type-safety completo em produção,
// implemente code-generation dos tipos do backend
export const trpc = createTRPCReact();
