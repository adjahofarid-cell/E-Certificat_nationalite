import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreerAgentDto } from './dto/creer-agent.dto';

const VUE_AGENT = {
    id: true,
    nom: true,
    prenom: true,
    email: true,
    telephone: true,
    actif: true,
    dateCreation: true,
    _count: { select: { demandesPrises: true } },
} as const;

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) {}

    agents() {
        return this.prisma.utilisateur.findMany({
            where: { role: 'AGENT' },
            orderBy: { dateCreation: 'desc' },
            select: VUE_AGENT,
        });
    }

    async creerAgent(dto: CreerAgentDto) {
        const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
        if (existant) throw new ConflictException('Cet email est déjà utilisé');

        const motDePasse = await bcrypt.hash(dto.motDePasse, 10);
        try {
            return await this.prisma.utilisateur.create({
                data: {
                    nom: dto.nom,
                    prenom: dto.prenom,
                    email: dto.email,
                    telephone: dto.telephone,
                    motDePasse,
                    role: 'AGENT', // forcé ici : jamais lu depuis la requête
                },
                select: VUE_AGENT,
            });
        } catch (e) {
            if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Cet email est déjà utilisé');
            throw e;
        }
    }

    async changerStatut(id: string, actif: boolean) {
        // Seuls les agents sont gérables ici : impossible de viser un administrateur ou un citoyen.
        const agent = await this.prisma.utilisateur.findFirst({ where: { id, role: 'AGENT' }, select: { id: true } });
        if (!agent) throw new NotFoundException('Agent introuvable.');

        const liberes = await this.prisma.$transaction(async (tx) => {
            await tx.utilisateur.update({ where: { id }, data: { actif } });
            if (actif) return 0;
            // Un agent désactivé ne doit pas bloquer ses dossiers : ceux qui attendent une décision
            // retournent dans la liste commune.
            const r = await tx.demande.updateMany({
                where: { agentId: id, statut: 'EN_TRAITEMENT' },
                data: { agentId: null, datePriseEnCharge: null },
            });
            return r.count;
        });

        const maj = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id }, select: VUE_AGENT });
        return { agent: maj, liberes };
    }
}