import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatutDemande, TypePiece } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockageService } from '../stockage/stockage.service';
import { DocumentsService } from '../documents/documents.service';
import { verifierTransition } from '../demandes/transitions';
import { AuditService } from '../audit/audit.service';

// L'agent ne voit que les demandes payées (§2.6).
const STATUTS_FILE: StatutDemande[] = ['EN_TRAITEMENT', 'VALIDEE', 'REJETEE', 'DOCUMENT_GENERE'];

@Injectable()
export class AgentService {
    constructor(
        private prisma: PrismaService,
        private stockage: StockageService,
        private documents: DocumentsService,
        private audit: AuditService,
    ) {}

    file() {
        return this.prisma.demande.findMany({
            where: { statut: { in: STATUTS_FILE } },
            orderBy: { dateSoumission: 'desc' },
            select: {
                id: true,
                numeroDossier: true,
                statut: true,
                dateSoumission: true,
                citoyen: { select: { nom: true, prenom: true } },
                agent: { select: { id: true, nom: true, prenom: true } },
            },
        });
    }

    async detail(id: string) {
        const d = await this.prisma.demande.findFirst({
            where: { id, statut: { in: STATUTS_FILE } },
            select: {
                id: true,
                numeroDossier: true,
                statut: true,
                dateSoumission: true,
                datePriseEnCharge: true,
                dateDecision: true,
                dateNaissance: true,
                lieuNaissance: true,
                nomPere: true,
                nomMere: true,
                adresse: true,
                citoyen: { select: { nom: true, prenom: true, email: true, telephone: true, dateCreation: true } },
                agent: { select: { id: true, nom: true, prenom: true } },
                motifRejet: { select: { libelle: true } },
                pieces: { select: { type: true, nomFichier: true, typeMime: true, taille: true, dateUpload: true } },
                paiements: {
                    where: { statut: 'SUCCES' },
                    select: { reference: true, mode: true, montant: true, devise: true, datePaiement: true },
                    take: 1,
                },
                document: {
                    select: {
                        statut: true,
                        identifiantPublic: true,
                        hashSigne: true,
                        dateGeneration: true,
                        dateEnregistrementSigne: true,
                    },
                },
            },
        });
        if (!d) throw new NotFoundException('Demande introuvable.');

        // Historique reconstitué à partir des dates enregistrées.
        const evenements: { libelle: string; date: Date }[] = [];
        if (d.dateSoumission) evenements.push({ libelle: 'Demande soumise par le citoyen', date: d.dateSoumission });
        const p = d.paiements[0];
        if (p) {
            const mode = p.mode === 'VISA' ? 'Carte VISA' : 'Mobile Money';
            evenements.push({ libelle: `Paiement confirmé : ${mode}, réf. ${p.reference} (paiement simulé)`, date: p.datePaiement });
        }
        if (d.datePriseEnCharge && d.agent) {
            evenements.push({ libelle: `Prise en charge par ${d.agent.prenom} ${d.agent.nom}`, date: d.datePriseEnCharge });
        }
        if (d.dateDecision) {
            evenements.push({
                libelle: d.statut === 'REJETEE' ? `Demande rejetée. Motif : ${d.motifRejet?.libelle ?? ''}` : 'Demande validée par l’agent',
                date: d.dateDecision,
            });
        }
        if (d.document) {
            evenements.push({ libelle: 'Projet de certificat généré', date: d.document.dateGeneration });
            if (d.document.dateEnregistrementSigne) {
                evenements.push({
                    libelle: 'Document signé enregistré (empreinte SHA-256 calculée)',
                    date: d.document.dateEnregistrementSigne,
                });
            }
        }
        evenements.sort((a, b) => a.date.getTime() - b.date.getTime());

        return { ...d, historique: evenements };
    }

    motifs() {
        return this.prisma.motifRejet.findMany({
            select: { id: true, libelle: true },
            orderBy: { libelle: 'asc' },
        });
    }

    async prendre(id: string, agentId: string) {
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId: null },
            data: { agentId, datePriseEnCharge: new Date() },
        });
        if (res.count === 0) {
            throw new ConflictException('Ce dossier n’est plus disponible : un autre agent s’en occupe déjà.');
        }
        const d = await this.detail(id);
        await this.audit.enregistrer('PRISE_EN_CHARGE', { acteurId: agentId, demandeId: id, dossier: d.numeroDossier });
        return d;
    }

    async valider(id: string, agentId: string) {
        verifierTransition('EN_TRAITEMENT', 'VALIDEE');
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId },
            data: { statut: 'VALIDEE', dateDecision: new Date() },
        });
        if (res.count === 0) {
            throw new ConflictException('Action impossible : vous devez avoir pris en charge cette demande, qui doit être en traitement.');
        }
        const d = await this.detail(id);
        await this.audit.enregistrer('VALIDATION', { acteurId: agentId, demandeId: id, dossier: d.numeroDossier });
        return d;
    }

    async rejeter(id: string, agentId: string, motifId: string) {
        const motif = await this.prisma.motifRejet.findUnique({ where: { id: motifId } });
        if (!motif) throw new BadRequestException('Motif de rejet inconnu.');
        verifierTransition('EN_TRAITEMENT', 'REJETEE');
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId },
            data: { statut: 'REJETEE', motifRejetId: motifId, dateDecision: new Date() },
        });
        if (res.count === 0) {
            throw new ConflictException('Action impossible : vous devez avoir pris en charge cette demande, qui doit être en traitement.');
        }
        const d = await this.detail(id);
        await this.audit.enregistrer('REJET', {
            acteurId: agentId,
            demandeId: id,
            dossier: d.numeroDossier,
            detail: `Motif : ${motif.libelle}`,
        });
        return d;
    }

    async lirePiece(id: string, type: TypePiece) {
        const piece = await this.prisma.pieceJustificative.findFirst({
            where: { type, demande: { id, statut: { in: STATUTS_FILE } } },
            select: { cleStockage: true, typeMime: true, nomFichier: true },
        });
        if (!piece) throw new NotFoundException('Pièce introuvable.');
        try {
            const buffer = await this.stockage.lire(piece.cleStockage);
            return { buffer, typeMime: piece.typeMime, nomFichier: piece.nomFichier };
        } catch {
            throw new NotFoundException('Le fichier est introuvable sur le serveur.');
        }
    }

    async genererProjet(id: string, agentId: string) {
        await this.documents.genererProjet(id, agentId);
        const d = await this.detail(id);
        await this.audit.enregistrer('PROJET_GENERE', { acteurId: agentId, demandeId: id, dossier: d.numeroDossier });
        return d;
    }

    projet(id: string, agentId: string) {
        return this.documents.lireProjet(id, agentId);
    }

    async enregistrerSigne(id: string, agentId: string, fichier: Express.Multer.File | undefined) {
        await this.documents.enregistrerSigne(id, agentId, fichier);
        const d = await this.detail(id);
        await this.audit.enregistrer('DOCUMENT_SIGNE', {
            acteurId: agentId,
            demandeId: id,
            dossier: d.numeroDossier,
            detail: `SHA-256 : ${d.document?.hashSigne ?? ''}`,
        });
        return d;
    }
}