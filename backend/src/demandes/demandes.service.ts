import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { StatutDemande } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrouillonDto } from './dto/brouillon.dto';
import { verifierTransition } from './transitions';

const STATUTS_ACTIFS: StatutDemande[] = ['BROUILLON', 'EN_ATTENTE_PAIEMENT', 'EN_TRAITEMENT', 'VALIDEE'];

const PIECES_OBLIGATOIRES = [
    { type: 'IDENTITE', libelle: 'Pièce d’identité en cours de validité (CNI ou passeport)' },
    { type: 'ACTE_NAISSANCE', libelle: 'Acte de naissance' },
    { type: 'DOMICILE', libelle: 'Justificatif de domicile' },
    { type: 'PHOTO', libelle: 'Photo d’identité' },
] as const;

// Ce que le citoyen a le droit de voir : jamais de chemin de fichier ni d'information interne.
const VUE_CITOYEN = {
    id: true,
    numeroDossier: true,
    statut: true,
    dateNaissance: true,
    lieuNaissance: true,
    nomPere: true,
    nomMere: true,
    adresse: true,
    dateSoumission: true,
    motifRejet: { select: { libelle: true } },
    pieces: { select: { type: true, nomFichier: true, taille: true } },
    paiements: {
        select: { reference: true, mode: true, statut: true, datePaiement: true },
        orderBy: { datePaiement: 'asc' },
    },
    document: { select: { identifiantPublic: true, hashSigne: true } },
} as const;

@Injectable()
export class DemandesService {
    constructor(private prisma: PrismaService) {}

    async courante(citoyenId: string) {
        const d = await this.prisma.demande.findFirst({
            where: { citoyenId },
            orderBy: { dateCreation: 'desc' },
            select: VUE_CITOYEN,
        });
        if (!d) return null;
        // Le document n'est visible qu'une fois le certificat signé enregistré.
        return d.statut === 'DOCUMENT_GENERE' ? d : { ...d, document: null };
    }

    async sauvegarderBrouillon(citoyenId: string, dto: BrouillonDto) {
        const donnees = {
            dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
            lieuNaissance: dto.lieuNaissance?.trim() || null,
            nomPere: dto.nomPere?.trim() || null,
            nomMere: dto.nomMere?.trim() || null,
            adresse: dto.adresse?.trim() || null,
        };

        const active = await this.prisma.demande.findFirst({
            where: { citoyenId, statut: { in: STATUTS_ACTIFS } },
        });
        if (active && active.statut !== 'BROUILLON') {
            throw new ConflictException('Une demande est déjà en cours : vous ne pouvez pas en créer une nouvelle.');
        }

        try {
            if (active) {
                // Condition sur le statut : si la demande vient d'être soumise, rien n'est modifié.
                const res = await this.prisma.demande.updateMany({
                    where: { id: active.id, statut: 'BROUILLON' },
                    data: donnees,
                });
                if (res.count === 0) throw new ConflictException('Cette demande a déjà été soumise et ne peut plus être modifiée.');
            } else {
                await this.prisma.demande.create({ data: { citoyenId, ...donnees } });
            }
        } catch (e) {
            if ((e as { code?: string }).code === 'P2002') {
                throw new ConflictException('Une demande est déjà en cours.');
            }
            throw e;
        }
        return this.courante(citoyenId);
    }

    async soumettre(citoyenId: string) {
        const d = await this.prisma.demande.findFirst({
            where: { citoyenId, statut: 'BROUILLON' },
            include: { pieces: { select: { type: true } } },
        });
        if (!d) throw new NotFoundException('Aucun brouillon à soumettre.');

        const erreurs: string[] = [];
        if (!d.dateNaissance) erreurs.push('Date de naissance : champ obligatoire.');
        else if (d.dateNaissance > new Date()) erreurs.push('Date de naissance : elle ne peut pas être dans le futur.');
        if (!d.lieuNaissance) erreurs.push('Lieu de naissance : champ obligatoire.');
        if (!d.nomPere) erreurs.push('Nom et prénom du père : champ obligatoire.');
        if (!d.nomMere) erreurs.push('Nom et prénom de la mère : champ obligatoire.');
        if (!d.adresse) erreurs.push('Adresse de résidence : champ obligatoire.');
        for (const p of PIECES_OBLIGATOIRES) {
            if (!d.pieces.some((x) => x.type === p.type)) erreurs.push(`Pièce manquante : ${p.libelle}.`);
        }
        if (erreurs.length > 0) throw new BadRequestException(erreurs);

        verifierTransition(d.statut, 'EN_ATTENTE_PAIEMENT');
        const numeroDossier = await this.prochainNumero();

        const res = await this.prisma.demande.updateMany({
            where: { id: d.id, statut: 'BROUILLON' },
            data: { statut: 'EN_ATTENTE_PAIEMENT', numeroDossier, dateSoumission: new Date() },
        });
        if (res.count === 0) throw new ConflictException('Cette demande a déjà été soumise.');
        return this.courante(citoyenId);
    }

    private async prochainNumero() {
        const lignes = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('numero_dossier_seq') AS n`;
        const n = Number(lignes[0].n);
        return `CN-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`;
    }
}