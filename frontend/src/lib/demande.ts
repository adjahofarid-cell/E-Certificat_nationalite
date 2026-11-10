export type StatutDemande =
    | 'BROUILLON'
    | 'EN_ATTENTE_PAIEMENT'
    | 'EN_TRAITEMENT'
    | 'VALIDEE'
    | 'DOCUMENT_GENERE'
    | 'REJETEE'
    | 'ANNULEE'
    | 'EXPIREE';

export type TypePiece = 'IDENTITE' | 'ACTE_NAISSANCE' | 'DOMICILE' | 'PHOTO' | 'PARENTS';
export type Fichiers = Partial<Record<TypePiece, File>>;

export const PIECES: { type: TypePiece; libelle: string; obligatoire: boolean }[] = [
    { type: 'IDENTITE', libelle: 'Pièce d’identité en cours de validité (CNI ou passeport)', obligatoire: true },
    { type: 'ACTE_NAISSANCE', libelle: 'Acte de naissance', obligatoire: true },
    { type: 'DOMICILE', libelle: 'Justificatif de domicile', obligatoire: true },
    { type: 'PHOTO', libelle: 'Photo d’identité', obligatoire: true },
    { type: 'PARENTS', libelle: 'Pièces d’état civil des parents', obligatoire: false },
];

export const FORMATS_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png'];
export const TAILLE_MAX = 5 * 1024 * 1024;
export const MONTANT_AFFICHE = '10 000 XAF';

export type Formulaire = {
    dateNaissance: string;
    lieuNaissance: string;
    nomPere: string;
    nomMere: string;
    adresse: string;
};

export const FORMULAIRE_VIDE: Formulaire = {
    dateNaissance: '',
    lieuNaissance: '',
    nomPere: '',
    nomMere: '',
    adresse: '',
};

export const CHAMPS: { cle: keyof Formulaire; label: string; type?: string }[] = [
    { cle: 'dateNaissance', label: 'Date de naissance', type: 'date' },
    { cle: 'lieuNaissance', label: 'Lieu de naissance' },
    { cle: 'nomPere', label: 'Nom et prénom du père' },
    { cle: 'nomMere', label: 'Nom et prénom de la mère' },
    { cle: 'adresse', label: 'Adresse de résidence' },
];

export type ModePaiement = 'MOBILE_MONEY' | 'VISA';

export type PaiementVue = {
    reference: string;
    mode: ModePaiement;
    statut: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
    datePaiement: string;
};

// Forme exacte de la réponse du backend (GET /demandes/courante)
export type Demande = {
    id: string;
    statut: StatutDemande;
    numeroDossier: string | null;
    dateNaissance: string | null;
    lieuNaissance: string | null;
    nomPere: string | null;
    nomMere: string | null;
    adresse: string | null;
    dateSoumission: string | null;
    motifRejet: { libelle: string } | null;
    pieces: { type: TypePiece; nomFichier: string; taille: number }[];
    paiements: PaiementVue[];
    document: { identifiantPublic: string; hashSigne: string | null } | null;
};

// Remplit le formulaire à partir de ce que le serveur a enregistré
export function versFormulaire(d: Demande): Formulaire {
    return {
        dateNaissance: d.dateNaissance ? d.dateNaissance.slice(0, 10) : '',
        lieuNaissance: d.lieuNaissance ?? '',
        nomPere: d.nomPere ?? '',
        nomMere: d.nomMere ?? '',
        adresse: d.adresse ?? '',
    };
}

// Position dans la barre de progression (0 à 3, 4 = tout est terminé)
export const ETAPES_RAIL = ['Demande', 'Paiement', 'Traitement', 'Certificat'];
export const INDEX_RAIL: Record<StatutDemande, number> = {
    BROUILLON: 0,
    EN_ATTENTE_PAIEMENT: 1,
    ANNULEE: 1,
    EXPIREE: 1,
    EN_TRAITEMENT: 2,
    VALIDEE: 2,
    REJETEE: 2,
    DOCUMENT_GENERE: 4,
};

// Suivi par statut (niveau 1)
export type EtatEtape = 'done' | 'current' | 'todo' | 'rejected';

export function etapesSuivi(statut: StatutDemande): { label: string; etat: EtatEtape }[] {
    const labels = [
        'Demande déposée',
        'Paiement confirmé',
        'Examen par un agent',
        'Signature du certificat',
        'Certificat disponible',
    ];
    const courant: Partial<Record<StatutDemande, number>> = {
        EN_TRAITEMENT: 2,
        VALIDEE: 3,
        REJETEE: 2,
        DOCUMENT_GENERE: 5,
    };
    const c = courant[statut] ?? 0;
    return labels.map((label, i) => ({
        label,
        etat: i < c ? 'done' : i === c ? (statut === 'REJETEE' ? 'rejected' : 'current') : 'todo',
    }));
}

export function verifierFichier(f: File): string | null {
    if (!FORMATS_ACCEPTES.includes(f.type)) return 'Format non accepté : PDF, JPG ou PNG uniquement.';
    if (f.size > TAILLE_MAX) return 'Fichier trop volumineux : 5 Mo maximum.';
    return null;
}

export function verifierDossier(formulaire: Formulaire, presentes: TypePiece[]): string[] {
    const erreurs: string[] = [];
    for (const c of CHAMPS) {
        if (!formulaire[c.cle].trim()) erreurs.push(`${c.label} : champ obligatoire.`);
    }
    if (formulaire.dateNaissance && new Date(formulaire.dateNaissance) > new Date()) {
        erreurs.push('Date de naissance : elle ne peut pas être dans le futur.');
    }
    for (const p of PIECES) {
        if (p.obligatoire && !presentes.includes(p.type)) erreurs.push(`Pièce manquante : ${p.libelle}.`);
    }
    return erreurs;
}

// Données d’exemple pour l’aperçu (développement uniquement)
export function exemple(statut: StatutDemande): Demande {
    const succes: PaiementVue = {
        reference: 'SIM-1730000000001',
        mode: 'MOBILE_MONEY',
        statut: 'SUCCES',
        datePaiement: '2026-11-02T09:00:00.000Z',
    };
    const base: Demande = {
        id: 'exemple',
        statut,
        numeroDossier: 'CN-2026-000123',
        dateNaissance: '1990-05-14T00:00:00.000Z',
        lieuNaissance: 'Libreville',
        nomPere: 'Jean MOUKAMBI',
        nomMere: 'Marie ADJAHO',
        adresse: 'Akanda, Libreville',
        dateSoumission: '2026-11-02T08:00:00.000Z',
        motifRejet: null,
        pieces: [],
        paiements: [succes],
        document: null,
    };
    switch (statut) {
        case 'BROUILLON':
            return { ...base, numeroDossier: null, dateSoumission: null, paiements: [] };
        case 'EN_ATTENTE_PAIEMENT':
            return { ...base, paiements: [{ ...succes, reference: 'SIM-1730000000000', mode: 'VISA', statut: 'ECHEC' }] };
        case 'REJETEE':
            return { ...base, motifRejet: { libelle: 'Justificatif de domicile expiré' } };
        case 'DOCUMENT_GENERE':
            return {
                ...base,
                document: {
                    identifiantPublic: 'k7Hq2mXv9RtP',
                    hashSigne: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                },
            };
        default:
            return base;
    }
}
