import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const motDePasse = await bcrypt.hash('Passw0rd!', 10);

    await prisma.utilisateur.upsert({
        where: { email: 'admin@demo.ga' },
        update: {},
        create: {
            nom: 'Admin',
            prenom: 'Demo',
            email: 'admin@demo.ga',
            motDePasse,
            role: Role.ADMIN,
        },
    });

    await prisma.utilisateur.upsert({
        where: { email: 'agent@demo.ga' },
        update: {},
        create: {
            nom: 'Agent',
            prenom: 'Demo',
            email: 'agent@demo.ga',
            motDePasse,
            role: Role.AGENT,
        },
    });
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });