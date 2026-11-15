import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ActionAudit } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
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

const TAILLE_PAGE = 50;

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService, private audit: AuditService) {}

    agents() {
        return this.prisma.utilisateur.findMany({
            where: { role: 'AGENT' },
            orderBy: { dateCreation: 'desc' },
            select: VUE_AGENT,
        });
    }

    async creerAgent(dto: CreerAgentDto, acteurId: string) {
        const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
        if (existant) throw new ConflictException('Cet email est déjà utilisé');

        const motDePasse = await bcrypt.hash(dto.motDePasse, 10);
        let agent;
        try {
            agent = await this.prisma.utilisateur.create({
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
        await this.audit.enregistrer('AGENT_CREE', {
            acteurId,
            detail: `${agent.prenom} ${agent.nom} (${agent.email})`,
        });
        return agent;
    }

    async changerStatut(id: string, actif: boolean, acteurId: string) {
        // Seuls les agents sont gérables ici : impossible de viser un administrateur ou un citoyen.
        const cible = await this.prisma.utilisateur.findFirst({
            where: { id, role: 'AGENT' },
            select: { prenom: true, nom: true, email: true },
        });
        if (!cible) throw new NotFoundException('Agent introuvable.');

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

        await this.audit.enregistrer(actif ? 'AGENT_REACTIVE' : 'AGENT_DESACTIVE', {
            acteurId,
            detail:
                `${cible.prenom} ${cible.nom} (${cible.email})` +
                (liberes > 0 ? ` — ${liberes} dossier(s) remis dans la liste commune` : ''),
        });

        const agent = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id }, select: VUE_AGENT });
        return { agent, liberes };
    }

    async journal(action: ActionAudit | undefined, pageBrute: string | undefined) {
        const page = Math.max(1, parseInt(pageBrute ?? '1', 10) || 1);
        const where = action ? { action } : {};
        const [total, lignes] = await Promise.all([
            this.prisma.audit.count({ where }),
            this.prisma.audit.findMany({
                where,
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                skip: (page - 1) * TAILLE_PAGE,
                take: TAILLE_PAGE,
                select: { id: true, date: true, action: true, acteurNom: true, acteurRole: true, dossier: true, detail: true },
            }),
        ]);
        return { total, page, taille: TAILLE_PAGE, lignes };
    }
}