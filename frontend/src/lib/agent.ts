import { StatutDemande, TypePiece } from './demande';

export type LigneFile = {
    id: string;
    numeroDossier: string | null;
    statut: StatutDemande;
    dateSoumission: string | null;
    citoyen: { nom: string; prenom: string };
    agent: { id: string; nom: string; prenom: string } | null;
};

export type DetailDemande = Omit<LigneFile, 'citoyen'> & {
    citoyen: { nom: string; prenom: string; email: string; telephone: string | null };
    dateNaissance: string | null;
    lieuNaissance: string | null;
    nomPere: string | null;
    nomMere: string | null;
    adresse: string | null;
    motifRejet: { libelle: string } | null;
    pieces: { type: TypePiece; nomFichier: string; typeMime: string; taille: number }[];
    document: {
        statut: 'PROJET_GENERE' | 'SIGNE_ENREGISTRE' | 'REVOQUE';
        identifiantPublic: string;
        hashSigne: string | null;
        dateGeneration: string;
        dateEnregistrementSigne: string | null;
    } | null;
};

export type Motif = { id: string; libelle: string };

export const LIBELLE_STATUT: Record<StatutDemande, string> = {
    BROUILLON: 'Brouillon',
    EN_ATTENTE_PAIEMENT: 'En attente de paiements',
    EN_TRAITEMENT: 'En traitement',
    VALIDEE: 'Validée',
    DOCUMENT_GENERE: 'Certificat signé',
    REJETEE: 'Rejetée',
    ANNULEE: 'Annulée',
    EXPIREE: 'Expirée',
};

export const CLASSE_STATUT: Record<StatutDemande, string> = {
    BROUILLON: 'gris',
    EN_ATTENTE_PAIEMENT: 'attente',
    EN_TRAITEMENT: 'info',
    VALIDEE: 'validee',
    DOCUMENT_GENERE: 'sombre',
    REJETEE: 'rejetee',
    ANNULEE: 'gris',
    EXPIREE: 'gris',
};

// Date seule (« 1990-05-14T00:00:00Z » devient « 14/05/1990 ») sans décalage de fuseau
export function formaterDate(iso: string | null): string {
    if (!iso) return '—';
    const [a, m, j] = iso.slice(0, 10).split('-');
    return `${j}/${m}/${a}`;
}

export function formaterDateHeure(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
}