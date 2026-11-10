import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatutDemande } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifierTransition } from '../demandes/transitions';
import { TypePiece } from '../../generated/prisma/client';
import { StockageService } from '../stockage/stockage.service';
import { DocumentsService } from '../documents/documents.service';

// L'agent ne voit que les demandes payées (§2.6).
const STATUTS_FILE: StatutDemande[] = ['EN_TRAITEMENT', 'VALIDEE', 'REJETEE', 'DOCUMENT_GENERE'];



@Injectable()
export class AgentService {
    constructor(private prisma: PrismaService, private stockage: StockageService, private documents: DocumentsService,) {}



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
                dateNaissance: true,
                lieuNaissance: true,
                nomPere: true,
                nomMere: true,
                adresse: true,
                citoyen: { select: { nom: true, prenom: true, email: true, telephone: true } },
                agent: { select: { id: true, nom: true, prenom: true } },
                motifRejet: { select: { libelle: true } },
                pieces: { select: { type: true, nomFichier: true, typeMime: true, taille: true } },
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
        return d;
    }

    motifs() {
        return this.prisma.motifRejet.findMany({
            select: { id: true, libelle: true },
            orderBy: { libelle: 'asc' },
        });
    }

    async prendre(id: string, agentId: string) {
        // Une seule requête atomique : si deux agents cliquent en même temps, un seul gagne.
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId: null },
            data: { agentId },
        });
        if (res.count === 0) {
            throw new ConflictException('Cette demande n’est plus disponible : elle est déjà prise en charge ou n’est pas en traitement.');
        }
        return this.detail(id);
    }

    async valider(id: string, agentId: string) {
        verifierTransition('EN_TRAITEMENT', 'VALIDEE');
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId },
            data: { statut: 'VALIDEE' },
        });
        if (res.count === 0) {
            throw new ConflictException('Action impossible : vous devez avoir pris en charge cette demande, qui doit être en traitement.');
        }
        return this.detail(id);
    }

    async rejeter(id: string, agentId: string, motifId: string) {
        const motif = await this.prisma.motifRejet.findUnique({ where: { id: motifId } });
        if (!motif) throw new BadRequestException('Motif de rejet inconnu.');
        verifierTransition('EN_TRAITEMENT', 'REJETEE');
        const res = await this.prisma.demande.updateMany({
            where: { id, statut: 'EN_TRAITEMENT', agentId },
            data: { statut: 'REJETEE', motifRejetId: motifId },
        });
        if (res.count === 0) {
            throw new ConflictException('Action impossible : vous devez avoir pris en charge cette demande, qui doit être en traitement.');
        }
        return this.detail(id);
    }

    async lirePiece(id: string, type: TypePiece) {
        // Seules les demandes payées sont accessibles à l'agent, comme pour le détail.
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
        return this.detail(id);
    }

    projet(id: string, agentId: string) {
        return this.documents.lireProjet(id, agentId);
    }

    async enregistrerSigne(id: string, agentId: string, fichier: Express.Multer.File | undefined) {
        await this.documents.enregistrerSigne(id, agentId, fichier);
        return this.detail(id);
    }
}
