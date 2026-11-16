import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DemandesService } from '../demandes/demandes.service';
import { verifierTransition } from '../demandes/transitions';
import { PaiementDto } from './dto/paiement.dto';
import { ParametresService } from '../parametres/parametres.service';



@Injectable()
export class PaiementsService {
    constructor(private prisma: PrismaService, private demandes: DemandesService, private parametres: ParametresService) {}

    async payer(citoyenId: string, dto: PaiementDto) {
        // 1. Rejeu : la même clé donne le même résultat, jamais un second paiements.
        const deja = await this.prisma.paiement.findUnique({
            where: { cleIdempotence: dto.cleIdempotence },
            select: { demande: { select: { citoyenId: true } } },
        });
        if (deja) {

            if (deja.demande.citoyenId !== citoyenId) {
                throw new ConflictException('Clé d’idempotence déjà utilisée.');
            }
            return this.demandes.courante(citoyenId);
        }

        const montant = await this.parametres.montantFrais();
        if (dto.montant !== montant) {
            throw new ConflictException(`Le montant des frais a changé (${montant} XAF). Actualisez la page pour le voir.`);
        }

        // 2. La demande à payer : celle du citoyen connecté, jamais un id envoyé par le client.
        const demande = await this.prisma.demande.findFirst({
            where: { citoyenId, statut: 'EN_ATTENTE_PAIEMENT' },
            select: { id: true },
        });
        if (!demande) throw new ConflictException('Aucune demande en attente de paiements.');

        // 3. La tentative et le changement de statut dans une seule transaction.
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.paiement.create({
                    data: {
                        demandeId: demande.id,
                        montant: montant,
                        devise: 'XAF',
                        mode: dto.mode,
                        statut: dto.issue,
                        reference: `SIM-${randomBytes(5).toString('hex').toUpperCase()}`,
                        cleIdempotence: dto.cleIdempotence,
                    },
                });
                if (dto.issue === 'SUCCES') {
                    verifierTransition('EN_ATTENTE_PAIEMENT', 'EN_TRAITEMENT');
                    const res = await tx.demande.updateMany({
                        where: { id: demande.id, statut: 'EN_ATTENTE_PAIEMENT' },
                        data: { statut: 'EN_TRAITEMENT' },
                    });
                    if (res.count === 0) throw new ConflictException('Cette demande n’est plus en attente de paiements.');
                }
            });
        } catch (e) {
            if ((e as { code?: string }).code === 'P2002') {
                // Deux requêtes simultanées avec la même clé : la première a gagné, on rejoue.
                const rejeu = await this.prisma.paiement.findUnique({ where: { cleIdempotence: dto.cleIdempotence } });
                if (rejeu) return this.demandes.courante(citoyenId);
                // Sinon c'est l'index unique partiel : un paiements validé existe déjà.
                throw new ConflictException('Cette demande est déjà payée.');
            }
            throw e;
        }
        return this.demandes.courante(citoyenId);
    }
}