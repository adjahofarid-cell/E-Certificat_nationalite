import { ConflictException } from '@nestjs/common';
import { StatutDemande } from '../../generated/prisma/client';

// Table du §2.4 du cahier : toute autre transition est refusée.
const TRANSITIONS: Record<StatutDemande, StatutDemande[]> = {
    BROUILLON: ['EN_ATTENTE_PAIEMENT'],
    EN_ATTENTE_PAIEMENT: ['EN_TRAITEMENT', 'ANNULEE', 'EXPIREE'],
    EN_TRAITEMENT: ['VALIDEE', 'REJETEE'],
    VALIDEE: ['DOCUMENT_GENERE'],
    DOCUMENT_GENERE: [],
    REJETEE: [],
    ANNULEE: [],
    EXPIREE: [],
};

export function verifierTransition(depart: StatutDemande, arrivee: StatutDemande) {
    if (!TRANSITIONS[depart].includes(arrivee)) {
        throw new ConflictException(`Transition interdite : ${depart} vers ${arrivee}.`);
    }
}