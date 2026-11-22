import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './config/db';

/**
 * Aplica os arquivos de backend/migrations/*.sql em ordem, uma única vez cada
 * (registrados em _migrations). Exige --yes para executar.
 */
async function main() {
    const dir = path.resolve(__dirname, '../migrations');
    const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

    console.log(`Banco: ${process.env.DB_HOST} / ${process.env.DB_NAME}`);

    await pool.query(
        'CREATE TABLE IF NOT EXISTS _migrations (nome VARCHAR(255) PRIMARY KEY, aplicado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
    );
    const [rows] = await pool.query('SELECT nome FROM _migrations');
    const aplicadas = new Set((rows as Array<{ nome: string }>).map((r) => r.nome));
    const pendentes = arquivos.filter((f) => !aplicadas.has(f));

    if (!pendentes.length) {
        console.log('Nada a aplicar.');
        return;
    }
    console.log('Pendentes:', pendentes.join(', '));
    if (!process.argv.includes('--yes')) {
        console.log('Rode novamente com --yes para aplicar.');
        return;
    }

    for (const arquivo of pendentes) {
        const sql = fs.readFileSync(path.join(dir, arquivo), 'utf8');
        const comandos = sql
            .split(/;\s*(?:\r?\n|$)/)
            .map((c) => c.replace(/^\s*--.*$/gm, '').trim())
            .filter(Boolean);
        for (const comando of comandos) await pool.query(comando);
        await pool.query('INSERT INTO _migrations (nome) VALUES (?)', [arquivo]);
        console.log(`Aplicada: ${arquivo}`);
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
