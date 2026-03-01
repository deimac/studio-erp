import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
