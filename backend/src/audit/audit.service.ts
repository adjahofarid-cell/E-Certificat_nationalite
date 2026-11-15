import { Injectable, Logger } from '@nestjs/common';
import { ActionAudit } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Contexte = {
    acteurId?: string | null;
    demandeId?: string | null;
    dossier?: string | null;
    detail?: string | null;
};

@Injectable()
export class AuditService {
    private logger = new Logger(AuditService.name);

    constructor(private prisma: PrismaService) {}

    // Le journal ne doit jamais faire échouer l'action qu'il enregistre.
    async enregistrer(action: ActionAudit, ctx: Contexte = {}) {
        try {
            const acteur = ctx.acteurId
                ? await this.prisma.utilisateur.findUnique({
                    where: { id: ctx.acteurId },
                    select: { prenom: true, nom: true, role: true },
                })
                : null;
            await this.prisma.audit.create({
                data: {
                    action,
                    acteurId: ctx.acteurId ?? null,
                    acteurNom: acteur ? `${acteur.prenom} ${acteur.nom}` : null,
                    acteurRole: acteur?.role ?? null,
                    demandeId: ctx.demandeId ?? null,
                    dossier: ctx.dossier ?? null,
                    detail: ctx.detail ?? null,
                },
            });
        } catch (e) {
            this.logger.error(`Journal non enregistré (${action})`, e instanceof Error ? e.stack : String(e));
        }
    }
}