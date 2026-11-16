import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ActionAudit } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreerAgentDto } from './dto/creer-agent.dto';
import { ParametresService } from '../parametres/parametres.service';

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
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private parametres: ParametresService,
    ) {}
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

    // Toutes les demandes, tous statuts confondus, en lecture seule.
    demandes() {
        return this.prisma.demande.findMany({
            orderBy: { dateCreation: 'desc' },
            take: 500,
            select: {
                id: true,
                numeroDossier: true,
                statut: true,
                dateCreation: true,
                dateSoumission: true,
                citoyen: { select: { nom: true, prenom: true } },
                agent: { select: { id: true, nom: true, prenom: true } },
                document: { select: { statut: true } },
            },
        });
    }

// L'administrateur voit le dossier, jamais les fichiers des pièces (moindre privilège).
    async demande(id: string) {
        const d = await this.prisma.demande.findUnique({
            where: { id },
            select: {
                id: true,
                numeroDossier: true,
                statut: true,
                dateCreation: true,
                dateSoumission: true,
                datePriseEnCharge: true,
                dateDecision: true,
                citoyen: { select: { nom: true, prenom: true, email: true, telephone: true } },
                agent: { select: { id: true, nom: true, prenom: true } },
                motifRejet: { select: { libelle: true } },
                paiements: {
                    orderBy: { datePaiement: 'asc' },
                    select: { reference: true, mode: true, montant: true, devise: true, statut: true, datePaiement: true },
                },
                _count: { select: { pieces: true } },
                document: {
                    select: {
                        statut: true,
                        identifiantPublic: true,
                        hashSigne: true,
                        dateEnregistrementSigne: true,
                        dateRevocation: true,
                        motifRevocation: true,
                    },
                },
            },
        });
        if (!d) throw new NotFoundException('Demande introuvable.');
        return d;
    }

    async reattribuer(id: string, agentId: string | undefined, acteurId: string) {
        const d = await this.prisma.demande.findUnique({
            where: { id },
            select: { statut: true, numeroDossier: true, agent: { select: { prenom: true, nom: true } } },
        });
        if (!d) throw new NotFoundException('Demande introuvable.');
        if (d.statut !== 'EN_TRAITEMENT' && d.statut !== 'VALIDEE') {
            throw new ConflictException('Seuls les dossiers en cours de traitement peuvent être réattribués.');
        }

        let cible: { prenom: string; nom: string } | null = null;
        if (agentId) {
            cible = await this.prisma.utilisateur.findFirst({
                where: { id: agentId, role: 'AGENT', actif: true },
                select: { prenom: true, nom: true },
            });
            if (!cible) throw new BadRequestException('Agent inconnu ou désactivé.');
        } else if (d.statut === 'VALIDEE') {
            // Un dossier validé sans agent ne pourrait plus être mené à terme.
            throw new BadRequestException('Un dossier validé doit être attribué à un agent.');
        }

        const res = await this.prisma.demande.updateMany({
            where: { id, statut: d.statut },
            data: agentId
                ? { agentId, datePriseEnCharge: new Date() }
                : { agentId: null, datePriseEnCharge: null },
        });
        if (res.count === 0) throw new ConflictException('Le dossier a changé entre-temps : actualisez la page.');

        const nom = (a: { prenom: string; nom: string } | null) => (a ? `${a.prenom} ${a.nom}` : 'liste commune');
        await this.audit.enregistrer('DOSSIER_REATTRIBUE', {
            acteurId,
            demandeId: id,
            dossier: d.numeroDossier,
            detail: `${nom(d.agent)} → ${nom(cible)}`,
        });
        return this.demande(id);
    }

    async revoquer(id: string, motif: string, acteurId: string) {
        const d = await this.prisma.demande.findUnique({
            where: { id },
            select: { numeroDossier: true, document: { select: { statut: true } } },
        });
        if (!d) throw new NotFoundException('Demande introuvable.');
        if (d.document?.statut !== 'SIGNE_ENREGISTRE') {
            throw new ConflictException('Seul un certificat signé et enregistré, non encore révoqué, peut être révoqué.');
        }
        const res = await this.prisma.document.updateMany({
            where: { demandeId: id, statut: 'SIGNE_ENREGISTRE' },
            data: { statut: 'REVOQUE', motifRevocation: motif.trim(), dateRevocation: new Date() },
        });
        if (res.count === 0) throw new ConflictException('Ce certificat vient d’être révoqué.');
        await this.audit.enregistrer('DOCUMENT_REVOQUE', {
            acteurId,
            demandeId: id,
            dossier: d.numeroDossier,
            detail: `Motif : ${motif.trim()}`,
        });
        return this.demande(id);
    }

    async statistiques() {
        const [parStatut, delais, certificatsEmis, certificatsRevoques, agents] = await Promise.all([
            this.prisma.demande.groupBy({ by: ['statut'], _count: { _all: true } }),
            this.prisma.$queryRaw<{ attente: number | null; decision: number | null; total: number | null }[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (d."datePriseEnCharge" - d."dateSoumission")))::float8 AS attente,
        AVG(EXTRACT(EPOCH FROM (d."dateDecision" - d."datePriseEnCharge")))::float8 AS decision,
        AVG(EXTRACT(EPOCH FROM (doc."dateEnregistrementSigne" - d."dateSoumission")))::float8 AS total
      FROM "Demande" d
      LEFT JOIN "Document" doc ON doc."demandeId" = d.id
      WHERE d."dateSoumission" IS NOT NULL`,
            this.prisma.document.count({ where: { statut: { in: ['SIGNE_ENREGISTRE', 'REVOQUE'] } } }),
            this.prisma.document.count({ where: { statut: 'REVOQUE' } }),
            this.prisma.utilisateur.findMany({
                where: { role: 'AGENT' },
                orderBy: { prenom: 'asc' },
                select: { id: true, prenom: true, nom: true, actif: true, demandesPrises: { select: { statut: true } } },
            }),
        ]);

        const compte: Record<string, number> = {};
        for (const l of parStatut) compte[l.statut] = l._count._all;
        const n = (s: string) => compte[s] ?? 0;
        const traitees = n('VALIDEE') + n('DOCUMENT_GENERE') + n('REJETEE');

        return {
            total: parStatut.reduce((somme, l) => somme + l._count._all, 0),
            parStatut: compte,
            traitees,
            // Taux de rejet : rejetées sur l'ensemble des dossiers sur lesquels une décision a été prise.
            tauxRejet: traitees > 0 ? Math.round((n('REJETEE') / traitees) * 100) : null,
            delais: delais[0] ?? { attente: null, decision: null, total: null },
            certificats: { emis: certificatsEmis, revoques: certificatsRevoques },
            agents: agents.map((a) => ({
                id: a.id,
                prenom: a.prenom,
                nom: a.nom,
                actif: a.actif,
                pris: a.demandesPrises.length,
                enCours: a.demandesPrises.filter((d) => d.statut === 'EN_TRAITEMENT' || d.statut === 'VALIDEE').length,
                traites: a.demandesPrises.filter((d) => ['VALIDEE', 'DOCUMENT_GENERE', 'REJETEE'].includes(d.statut)).length,
            })),
        };
    }

    async changerFrais(montant: number, acteurId: string) {
        const ancien = await this.parametres.montantFrais();
        if (ancien !== montant) {
            await this.parametres.definirMontantFrais(montant);
            await this.audit.enregistrer('FRAIS_MODIFIES', { acteurId, detail: `${ancien} XAF → ${montant} XAF` });
        }
        return { montant, devise: 'XAF' };
    }
}