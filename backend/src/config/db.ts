import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../drizzle/schema';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // O MySQL fecha conexões ociosas; sem isso o pool devolve conexão morta ("Failed query")
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    maxIdle: 2,
    idleTimeout: 60_000,
});

export const db = drizzle(pool, { schema, mode: 'default' });
export { pool };
