import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import multer from 'multer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './trpc/context';
import { usuariosRouter } from './trpc/routers/usuarios';
import { pessoasRouter } from './trpc/routers/pessoas';
import { servicosRouter } from './trpc/routers/servicos';
import { pacotesRouter } from './trpc/routers/pacotes';
import { vendasRouter } from './trpc/routers/vendas';
import { atendimentosRouter } from './trpc/routers/atendimentos';
import { financeiroRouter } from './trpc/routers/financeiro';
import { formasPagamentoRouter } from './trpc/routers/formasPagamento';
import { tecnicasRouter } from './trpc/routers/tecnicas';
import { unidadesRouter } from './trpc/routers/unidades';
import { receitasDespesasRouter } from './trpc/routers/receitasDespesas';
import { publicCatalogoRouter } from './trpc/routers/publicCatalogo';
import { createTRPCRouter } from './trpc/trpc';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Garantir que a pasta de uploads existe
import fs from 'fs';
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Servir arquivos estáticos (ex.: imagens)
app.use('/uploads', express.static(uploadsDir));

// Upload de imagens (serviços)
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas imagens são permitidas'));
    },
});

app.post('/api/upload', (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede 5 MB' : err.message });
        }
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        res.json({ url: `/uploads/${req.file.filename}` });
    });
});

app.get('/', (_req, res) => {
    res.send('Studio ERP Backend funcionando!');
});

export const appRouter = createTRPCRouter({
    usuarios: usuariosRouter,
    pessoas: pessoasRouter,
    servicos: servicosRouter,
    pacotes: pacotesRouter,
    vendas: vendasRouter,
    atendimentos: atendimentosRouter,
    financeiro: financeiroRouter,
    formasPagamento: formasPagamentoRouter,
    tecnicas: tecnicasRouter,
    unidades: unidadesRouter,
    receitasDespesas: receitasDespesasRouter,
    public: publicCatalogoRouter,
});

export type AppRouter = typeof appRouter;

app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext,
    }),
);

export default app;
