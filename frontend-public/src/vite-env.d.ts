/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// tRPC AppRouter type placeholder for production
// Em produção, a tipagem completa deve ser gerada do backend
type AppRouter = any;
