/**
 * Tipos compartilhados entre backend e frontend
 * 
 * Em desenvolvimento: importa AppRouter do backend
 * Em produção (Coolify): usa type-only para evitar erros de module resolution
 */

// Este arquivo é uma ponte entre frontend e backend
// Para type-safety completo em produção, você pode gerar este arquivo
// via code-generation a partir do backend compilado

export type AppRouter = any;
