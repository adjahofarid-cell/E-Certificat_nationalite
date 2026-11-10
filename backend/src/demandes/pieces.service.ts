import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TypePiece } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockageService } from '../stockage/stockage.service';
import { DemandesService } from './demandes.service';
import { detecterType } from './type-fichier';

// Multer lit les noms de fichiers en latin1 : on rétablit les accents.
function nettoyerNom(brut: string): string {
    const corrige = Buffer.from(brut, 'latin1').toString('utf8');
    const nom = corrige.includes('\uFFFD') ? brut : corrige;
    return nom.replace(/[\\/]/g, '_').slice(0, 120);
}

@Injectable()
export class PiecesService {
    constructor(
        private prisma: PrismaService,
        private stockage: StockageService,
        private demandes: DemandesService,
    ) {}

    async deposer(citoyenId: string, type: TypePiece, fichier: Express.Multer.File | undefined) {
        if (!fichier) throw new BadRequestException('Aucun fichier reçu.');
        const typeMime = detecterType(fichier.buffer);
        if (!typeMime) throw new BadRequestException('Format non accepté : PDF, JPG ou PNG uniquement.');

        const demande = await this.prisma.demande.findFirst({ where: { citoyenId, statut: 'BROUILLON' } });
        if (!demande) {
            throw new ConflictException('Aucun brouillon en cours : un dossier soumis ne peut plus être modifié.');
        }

        const cle = `pieces/${demande.id}/${randomUUID()}`;
        await this.stockage.enregistrer(cle, fichier.buffer);

        try {
            const ancienne = await this.prisma.$transaction(async (tx) => {
                // On revérifie dans la transaction : la demande a pu être soumise entre-temps.
                const encore = await tx.demande.findFirst({ where: { id: demande.id, statut: 'BROUILLON' }, select: { id: true } });
                if (!encore) throw new ConflictException('Cette demande a déjà été soumise et ne peut plus être modifiée.');

                const cible = { demandeId_type: { demandeId: demande.id, type } };
                const existante = await tx.pieceJustificative.findUnique({ where: cible });
                const donnees = {
                    nomFichier: nettoyerNom(fichier.originalname),
                    typeMime,
                    taille: fichier.size,
                    cleStockage: cle,
                };
                await tx.pieceJustificative.upsert({
                    where: cible,
                    create: { demandeId: demande.id, type, ...donnees },
                    update: { ...donnees, dateUpload: new Date() },
                });
                return existante?.cleStockage ?? null;
            });
            if (ancienne) await this.stockage.supprimer(ancienne);
        } catch (e) {
            await this.stockage.supprimer(cle); // pas de fichier orphelin si la base a refusé
            throw e;
        }
        return this.demandes.courante(citoyenId);
    }
}