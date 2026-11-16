import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import puppeteer from 'puppeteer';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { StockageService } from '../stockage/stockage.service';
import { detecterType } from '../demandes/type-fichier';
import { verifierTransition } from '../demandes/transitions';
import { DonneesCertificat, modeleCertificat } from './modele-certificat';

export const TAILLE_MAX_SIGNE = 10 * 1024 * 1024;

const dateFr = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '');

@Injectable()
export class DocumentsService {
    private urlFront: string;

    constructor(
        private prisma: PrismaService,
        private stockage: StockageService,
        config: ConfigService,
    ) {
        this.urlFront = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    }

    private async produirePdf(donnees: DonneesCertificat): Promise<Buffer> {
        const navigateur = await puppeteer.launch({ headless: true });
        try {
            const page = await navigateur.newPage();
            await page.setJavaScriptEnabled(false);
            await page.setContent(modeleCertificat(donnees), { waitUntil: 'load' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
            });
            return Buffer.from(pdf);
        } finally {
            await navigateur.close();
        }
    }

    // Opération 1 (§2.7) : projet à signer. Aucun hash n'est calculé ici.
    async genererProjet(demandeId: string, agentId: string) {
        const d = await this.prisma.demande.findFirst({
            where: { id: demandeId, statut: 'VALIDEE', agentId },
            include: { citoyen: { select: { nom: true, prenom: true } }, document: true },
        });
        if (!d) {
            throw new ConflictException('Génération impossible : la demande doit être validée et prise en charge par vous.');
        }
        // L'identifiant public reste le même si on régénère : les anciens tirages restent cohérents.
        const identifiantPublic = d.document?.identifiantPublic ?? randomBytes(9).toString('base64url');
        const qrDataUrl = await QRCode.toDataURL(`${this.urlFront}/verification/${identifiantPublic}`, {
            margin: 1,
            width: 240,
            errorCorrectionLevel: 'M',
        });

        const pdf = await this.produirePdf({
            numeroDossier: d.numeroDossier ?? '',
            identifiantPublic,
            qrDataUrl,
            prenom: d.citoyen.prenom,
            nom: d.citoyen.nom,
            dateNaissance: dateFr(d.dateNaissance),
            lieuNaissance: d.lieuNaissance ?? '',
            nomPere: d.nomPere ?? '',
            nomMere: d.nomMere ?? '',
            adresse: d.adresse ?? '',
            dateEdition: new Date().toLocaleDateString('fr-FR'),
        });

        const cle = `documents/${d.id}/projet-${randomUUID()}.pdf`;
        await this.stockage.enregistrer(cle, pdf);
        try {
            await this.prisma.document.upsert({
                where: { demandeId: d.id },
                create: { demandeId: d.id, identifiantPublic, cheminProjet: cle },
                update: { cheminProjet: cle, dateGeneration: new Date() },
            });
        } catch (e) {
            await this.stockage.supprimer(cle);
            throw e;
        }
        if (d.document?.cheminProjet) await this.stockage.supprimer(d.document.cheminProjet);
    }

    async lireProjet(demandeId: string, agentId: string) {
        const d = await this.prisma.demande.findFirst({
            where: { id: demandeId, statut: 'VALIDEE', agentId },
            select: { document: { select: { cheminProjet: true, statut: true } } },
        });
        if (!d?.document || d.document.statut !== 'PROJET_GENERE') {
            throw new NotFoundException('Aucun projet à signer pour cette demande.');
        }
        try {
            return await this.stockage.lire(d.document.cheminProjet);
        } catch {
            throw new NotFoundException('Le fichier est introuvable sur le serveur.');
        }
    }

    // Opération 2 (§2.7) : document signé, hash SHA-256, passage à DOCUMENT_GENERE.
    async enregistrerSigne(demandeId: string, agentId: string, fichier: Express.Multer.File | undefined) {
        if (!fichier) throw new BadRequestException('Aucun fichier reçu.');
        if (detecterType(fichier.buffer) !== 'application/pdf') {
            throw new BadRequestException('Le document signé doit être un PDF.');
        }
        const d = await this.prisma.demande.findFirst({
            where: { id: demandeId, statut: 'VALIDEE', agentId },
            include: { document: true },
        });
        if (!d || !d.document) {
            throw new ConflictException('Enregistrement impossible : demande non validée, non prise en charge par vous, ou projet non généré.');
        }
        verifierTransition('VALIDEE', 'DOCUMENT_GENERE');

        // Le hash est calculé sur les octets exacts reçus, qui sont aussi ceux qu'on stocke.
        const hash = createHash('sha256').update(fichier.buffer).digest('hex');
        const cle = `documents/${d.id}/signe-${randomUUID()}.pdf`;
        await this.stockage.enregistrer(cle, fichier.buffer);

        try {
            await this.prisma.$transaction(async (tx) => {
                const res = await tx.demande.updateMany({
                    where: { id: d.id, statut: 'VALIDEE', agentId },
                    data: { statut: 'DOCUMENT_GENERE' },
                });
                if (res.count === 0) throw new ConflictException('Cette demande a déjà été traitée.');
                await tx.document.update({
                    where: { demandeId: d.id },
                    data: { cheminSigne: cle, hashSigne: hash, statut: 'SIGNE_ENREGISTRE', dateEnregistrementSigne: new Date() },
                });
            });
        } catch (e) {
            await this.stockage.supprimer(cle);
            throw e;
        }
    }

    // Le citoyen ne télécharge que le document signé enregistré, jamais le projet.
    async lireSigne(citoyenId: string) {
        const d = await this.prisma.demande.findFirst({
            where: { citoyenId },
            orderBy: { dateCreation: 'desc' },
            select: { statut: true, document: { select: { statut: true, cheminSigne: true } } },
        });
        const doc = d?.document;
        if (!d || d.statut !== 'DOCUMENT_GENERE' || !doc || doc.statut !== 'SIGNE_ENREGISTRE' || !doc.cheminSigne) {
            throw new NotFoundException('Aucun certificat disponible.');
        }
        try {
            return await this.stockage.lire(doc.cheminSigne);
        } catch {
            throw new NotFoundException('Le fichier est introuvable sur le serveur.');
        }
    }

    // Vérification publique (§2.8) : uniquement par identifiant public, aucune donnée sensible.
    async verifier(identifiant: string) {
        if (!/^[A-Za-z0-9_-]{8,32}$/.test(identifiant)) return { resultat: 'NON_TROUVE' as const };
        const doc = await this.prisma.document.findUnique({
            where: { identifiantPublic: identifiant },
            select: {
                statut: true,
                hashSigne: true,
                dateEnregistrementSigne: true,
                demande: {
                    select: {
                        numeroDossier: true,
                        dateNaissance: true,
                        lieuNaissance: true,
                        nomPere: true,
                        nomMere: true,
                        adresse: true,
                        citoyen: { select: { nom: true, prenom: true } },
                    },
                },
            },
        });
        // Un simple projet n'est pas un certificat : il reste « non trouvé ».
        if (!doc || doc.statut === 'PROJET_GENERE') return { resultat: 'NON_TROUVE' as const };
        const d = doc.demande;
        // Le motif de révocation n'est volontairement pas sélectionné : il n'est pas public (§2.8).
        return {
            resultat: doc.statut === 'REVOQUE' ? ('REVOQUE' as const) : ('VALIDE' as const),
            certificat: {
                titre: 'Certificat de nationalité',
                numeroDossier: d.numeroDossier,
                prenom: d.citoyen.prenom,
                nom: d.citoyen.nom,
                dateNaissance: d.dateNaissance ? d.dateNaissance.toISOString().slice(0, 10) : null,
                lieuNaissance: d.lieuNaissance,
                nomPere: d.nomPere,
                nomMere: d.nomMere,
                adresse: d.adresse,
                dateEnregistrement: doc.dateEnregistrementSigne,
                empreinte: doc.hashSigne,
            },
        };
    }
}