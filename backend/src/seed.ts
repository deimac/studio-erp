import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from './config/db';
import { unidades, usuarios } from './drizzle/schema';

async function seed() {
    const [unidadeExistente] = await db
        .select({ id: unidades.id })
        .from(unidades)
        .where(eq(unidades.nome, 'Unidade Principal'))
        .limit(1);

    let unidadeId = unidadeExistente?.id;

    if (!unidadeId) {
        const result = await db.insert(unidades).values({ nome: 'Unidade Principal' }).$returningId();
        unidadeId = result[0]?.id;
    }

    if (!unidadeId) {
        throw new Error('Não foi possível criar ou localizar a unidade inicial.');
    }

    const [adminExistente] = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.email, 'admin@studio.com'))
        .limit(1);

    if (!adminExistente) {
        const senhaHash = await bcrypt.hash('123456', 10);

        await db.insert(usuarios).values({
            nome: 'Administrador',
            email: 'admin@studio.com',
            senha: senhaHash,
            perfil: 'ADMIN',
            id_unidade: unidadeId,
        });
    }

    console.log('Seed inicial concluída');
}

seed()
    .catch((error) => {
        console.error('Erro ao executar seed:', error);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
