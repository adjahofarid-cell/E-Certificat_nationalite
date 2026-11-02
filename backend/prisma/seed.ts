import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const motDePasse = await bcrypt.hash('Passw0rd!', 10);

    const motifs = [
        { code: 'PIECE_ILLISIBLE', libelle: 'Pièce illisible' },
        { code: 'IDENTITE_EXPIREE', libelle: 'Pièce d’identité expirée' },
        { code: 'DOMICILE_EXPIRE', libelle: 'Justificatif de domicile expiré' },
        { code: 'INCOHERENCE', libelle: 'Informations incohérentes avec les pièces' },
        { code: 'PIECE_NON_CONFORME', libelle: 'Pièce manquante ou non conforme' },
    ];

    for (const m of motifs) {
        await prisma.motifRejet.upsert({ where: { code: m.code }, update: {}, create: m });
    }

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