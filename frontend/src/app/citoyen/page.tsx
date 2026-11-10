'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, enregistrerFichier, ErreurApi, telecharger, Utilisateur } from '@/lib/api';
import { cheminSelonRole, deconnecter, lireUtilisateur } from '@/lib/session';
import {
    CHAMPS, Demande, ETAPES_RAIL, FORMULAIRE_VIDE, Formulaire, INDEX_RAIL,
    MONTANT_AFFICHE, ModePaiement, PIECES, PaiementVue, StatutDemande, TypePiece,
    etapesSuivi, exemple, verifierDossier, verifierFichier, versFormulaire,
} from '@/lib/demande';
import './citoyen.css';

const APERCU = process.env.NODE_ENV !== 'production';

const LIBELLE_PAIEMENT: Record<PaiementVue['statut'], string> = {
    EN_ATTENTE: 'En attente',
    SUCCES: 'Réussi',
    ECHEC: 'Échec',
};

const TEXTES = {
    EN_TRAITEMENT: {
        badge: 'En cours de traitement', classe: 'info', titre: 'Suivi de votre dossier',
        desc: 'Votre paiements est confirmé. Un agent examine votre dossier : il contrôle les pièces avant de le valider ou de le rejeter.',
    },
    VALIDEE: {
        badge: 'Dossier validé', classe: 'validee', titre: 'Votre dossier a été validé',
        desc: 'Le certificat est en cours de signature par l’autorité compétente. Vous pourrez le télécharger dès que le document signé sera enregistré.',
    },
    REJETEE: {
        badge: 'Rejetée', classe: 'rejetee', titre: 'Votre demande a été rejetée',
        desc: 'Le motif indiqué par l’agent figure ci-dessous. Vous pouvez déposer une nouvelle demande.',
    },
} as const;

/* ---------- Vues ---------- */

function VueFormulaire(props: {
    estBrouillon: boolean;
    enCours: boolean;
    formulaire: Formulaire;
    onChange: (f: Formulaire) => void;
    piecesServeur: Demande['pieces'];
    erreursPieces: Partial<Record<TypePiece, string>>;
    erreurs: string[];
    onFichier: (type: TypePiece, f: File | undefined) => void;
    onBrouillon: () => void;
    onSoumettre: () => void;
}) {
    const { formulaire } = props;
    return (
        <div className="card">
            {props.estBrouillon && <span className="badge info">Brouillon</span>}
            <h1 className="title">Déposer une demande de certificat de nationalité</h1>
            <p className="desc">
                Renseignez le formulaire et joignez les pièces justificatives. Vous pouvez enregistrer un
                brouillon et le modifier tant que la demande n’est pas soumise. Une fois soumise, elle ne
                peut plus être modifiée.
            </p>

            <h2 className="sous-titre">Informations</h2>
            <div className="grille">
                {CHAMPS.map((c) => (
                    <label className="champ" key={c.cle}>
                        <span>{c.label}</span>
                        <input
                            type={c.type ?? 'text'}
                            value={formulaire[c.cle]}
                            onChange={(e) => props.onChange({ ...formulaire, [c.cle]: e.target.value })}
                        />
                    </label>
                ))}
            </div>

            <h2 className="sous-titre">Pièces justificatives</h2>
            <p className="hint" style={{ margin: '0 0 10px' }}>PDF, JPG ou PNG, 5 Mo maximum par fichier.</p>
            {PIECES.map((p) => {
                const serveur = props.piecesServeur.find((x) => x.type === p.type);
                return (
                    <div key={p.type}>
                        <div className={`upload-row ${serveur ? 'done' : ''}`}>
                            <div>
                                <div className="name">{p.libelle}</div>
                                <div className="sub">
                                    {serveur
                                        ? `${serveur.nomFichier} (${(serveur.taille / 1024 / 1024).toFixed(2)} Mo, enregistrée)`
                                        : p.obligatoire ? 'Obligatoire' : 'Facultative'}
                                </div>
                            </div>
                            <label className={`chip-btn ${serveur ? 'attached' : ''}`}>
                                {serveur ? '✓ Remplacer' : 'Joindre'}
                                <input
                                    type="file"
                                    hidden
                                    disabled={props.enCours}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                        props.onFichier(p.type, e.target.files?.[0]);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                        {props.erreursPieces[p.type] && <div className="erreur-ligne">{props.erreursPieces[p.type]}</div>}
                    </div>
                );
            })}

            {props.erreurs.length > 0 && (
                <div className="erreurs">
                    <strong>Votre demande ne peut pas être traitée :</strong>
                    <ul>{props.erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
                </div>
            )}

            <div className="actions">
                <button type="button" className="btn" disabled={props.enCours} onClick={props.onBrouillon}>
                    Enregistrer le brouillon
                </button>
                <button type="button" className="btn primary" disabled={props.enCours} onClick={props.onSoumettre}>
                    {props.enCours ? 'Envoi...' : 'Soumettre ma demande'}
                </button>
            </div>
        </div>
    );
}

function VuePaiement({ demande, onPayer }: { demande: Demande; onPayer: () => void }) {
    return (
        <div className="card">
            <span className="badge attente">En attente de paiement</span>
            <h1 className="title">Votre demande a été enregistrée</h1>
            <div className="ref-box">
                <span>Numéro de dossier</span>
                <span className="mono">{demande.numeroDossier}</span>
            </div>
            <p className="desc">
                Votre dossier est désormais figé. Réglez les frais de dossier ({MONTANT_AFFICHE}) pour qu’il
                soit transmis à un agent. Le paiement est simulé : aucune transaction réelle n’est effectuée.
            </p>
            {demande.paiements.length > 0 && (
                <>
                    <h2 className="sous-titre" style={{ marginTop: 0 }}>Tentatives de paiement</h2>
                    <ul className="tentatives">
                        {demande.paiements.map((t) => (
                            <li key={t.reference}>
                                <span className="mono">{t.reference}</span>
                                <span>{LIBELLE_PAIEMENT[t.statut]}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <button type="button" className="btn primary block" onClick={onPayer}>Payer maintenant</button>
        </div>
    );
}

function VueSuivi({ demande, onNouvelle }: { demande: Demande; onNouvelle: () => void }) {
    const t = TEXTES[demande.statut as keyof typeof TEXTES];
    const rejetee = demande.statut === 'REJETEE';
    return (
        <div className="card">
            <span className={`badge ${t.classe}`}>{t.badge}</span>
            <h1 className="title">{t.titre}</h1>
            <div className="ref-box">
                <span>Numéro de dossier</span>
                <span className="mono">{demande.numeroDossier}</span>
            </div>
            {rejetee && <div className="motif-box">Motif : {demande.motifRejet?.libelle}</div>}
            <p className="desc" style={{ marginBottom: 0 }}>{t.desc}</p>
            <ul className="suivi">
                {etapesSuivi(demande.statut).map((e) => (
                    <li key={e.label} className={e.etat}>
                        <span className="suivi-dot"></span>
                        <span className="suivi-label">{e.label}</span>
                    </li>
                ))}
            </ul>
            {rejetee && (
                <>
                    <button type="button" className="btn primary block" style={{ marginTop: 18 }} onClick={onNouvelle}>
                        Déposer une nouvelle demande
                    </button>
                    <p className="hint">Le paiement simulé n’est pas remboursé dans cette version de démonstration.</p>
                </>
            )}
        </div>
    );
}

function VueTerminee({ demande, onNouvelle }: { demande: Demande; onNouvelle: () => void }) {
    const annulee = demande.statut === 'ANNULEE';
    return (
        <div className="card">
            <span className="badge rejetee">{annulee ? 'Annulée' : 'Expirée'}</span>
            <h1 className="title">{annulee ? 'Votre demande a été annulée' : 'Votre demande a expiré'}</h1>
            <p className="desc">Vous pouvez déposer une nouvelle demande.</p>
            <button type="button" className="btn primary block" onClick={onNouvelle}>Déposer une nouvelle demande</button>
        </div>
    );
}

function VueCertificat(props: { demande: Demande; onTelecharger: () => void; onNouvelle: () => void }) {
    const doc = props.demande.document;
    return (
        <div className="card">
            <span className="badge validee">Certificat disponible</span>
            <h1 className="title">Votre certificat est prêt</h1>
            <div className="ref-box">
                <span>Numéro de dossier</span>
                <span className="mono">{props.demande.numeroDossier}</span>
            </div>
            <p className="desc">
                Le certificat signé par l’autorité compétente a été enregistré. Seul ce document signé est
                téléchargeable.
            </p>
            <button type="button" className="btn primary block" onClick={props.onTelecharger}>
                Télécharger mon certificat (PDF)
            </button>
            {doc && (
                <dl className="infos">
                    <dt>Identifiant public (imprimé sur le document et dans le QR Code)</dt>
                    <dd className="mono">{doc.identifiantPublic}</dd>
                    {doc.hashSigne && (
                        <>
                            <dt>Empreinte SHA-256 du document signé</dt>
                            <dd className="mono">{doc.hashSigne}</dd>
                        </>
                    )}
                </dl>
            )}
            {doc && (
                <Link className="lien" href={`/verification/${doc.identifiantPublic}`}>
                    Voir la page de vérification publique
                </Link>
            )}
            <p className="hint">
                Toute personne peut vérifier ce certificat sans compte. La vérification est technique et ne
                garantit pas à elle seule la valeur juridique du document.
            </p>
            <button type="button" className="lien" onClick={props.onNouvelle}>Faire une nouvelle demande</button>
        </div>
    );
}

function ModalePaiement(props: {
    paiements: PaiementVue[];
    onPayer: (mode: ModePaiement, issue: 'SUCCES' | 'ECHEC', cle: string) => Promise<string | null>;
    onFermer: () => void;
}) {
    const [mode, setMode] = useState<ModePaiement>('MOBILE_MONEY');
    const [cle, setCle] = useState(() => crypto.randomUUID());
    const [envoi, setEnvoi] = useState(false);
    const [erreur, setErreur] = useState('');
    const [initial] = useState(props.paiements.length);

    // L'échec affiché vient de la réponse du serveur : une nouvelle tentative a été enregistrée.
    const derniere = props.paiements[props.paiements.length - 1];
    const echec = props.paiements.length > initial && derniere?.statut === 'ECHEC';

    async function lancer(issue: 'SUCCES' | 'ECHEC') {
        if (envoi) return;
        setEnvoi(true);
        setErreur('');
        const probleme = await props.onPayer(mode, issue, cle);
        if (probleme) setErreur(probleme); // même clé conservée : un nouvel essai reste idempotent
        else setCle(crypto.randomUUID()); // tentative enregistrée : la suivante aura sa propre clé
        setEnvoi(false);
    }

    return (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !envoi) props.onFermer(); }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Payer les frais de dossier">
                <h2>Payer les frais de dossier</h2>
                <div className="ref-box">
                    <span>Montant</span>
                    <strong>{MONTANT_AFFICHE}</strong>
                </div>
                <p className="desc">
                    Paiement simulé : aucune transaction réelle n’est effectuée et aucune donnée bancaire
                    n’est saisie ni conservée.
                </p>
                <div className="pay-options">
                    <button type="button" disabled={envoi} className={`pay-opt ${mode === 'MOBILE_MONEY' ? 'selected' : ''}`} onClick={() => setMode('MOBILE_MONEY')}>
                        Mobile Money
                    </button>
                    <button type="button" disabled={envoi} className={`pay-opt ${mode === 'VISA' ? 'selected' : ''}`} onClick={() => setMode('VISA')}>
                        Carte VISA
                    </button>
                </div>
                {echec && <div className="motif-box">Le paiement a échoué (simulation). Vous pouvez réessayer.</div>}
                {erreur && <div className="motif-box">{erreur}</div>}
                <button type="button" className="btn primary block" disabled={envoi} onClick={() => lancer('SUCCES')}>
                    {envoi ? 'Traitement...' : 'Simuler un paiement réussi'}
                </button>
                <button type="button" className="btn block" style={{ marginTop: 8 }} disabled={envoi} onClick={() => lancer('ECHEC')}>
                    Simuler un échec
                </button>
                <button type="button" className="lien" disabled={envoi} onClick={props.onFermer}>Fermer</button>
            </div>
        </div>
    );
}

/* ---------- Page ---------- */

export default function EspaceCitoyen() {
    const router = useRouter();
    const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
    const [demande, setDemande] = useState<Demande | null>(null);
    const [chargement, setChargement] = useState(true);
    const [erreurChargement, setErreurChargement] = useState('');
    const [enCours, setEnCours] = useState(false);
    const [formulaire, setFormulaire] = useState<Formulaire>(FORMULAIRE_VIDE);
    const [erreursPieces, setErreursPieces] = useState<Partial<Record<TypePiece, string>>>({});
    const [erreurs, setErreurs] = useState<string[]>([]);
    const [paiementOuvert, setPaiementOuvert] = useState(false);
    const [toast, setToast] = useState('');

    useEffect(() => {
        const u = lireUtilisateur();
        if (!u) router.replace('/connexion');
        else if (u.role !== 'CITOYEN') router.replace(cheminSelonRole(u.role));
        else setUtilisateur(u);
    }, [router]);

    // Chargement de la demande en cours depuis le serveur
    useEffect(() => {
        if (!utilisateur) return;
        api<Demande | null>('/demandes/courante')
            .then((d) => {
                setDemande(d);
                if (d) setFormulaire(versFormulaire(d));
            })
            .catch((e) => setErreurChargement(e instanceof Error ? e.message : 'Chargement impossible.'))
            .finally(() => setChargement(false));
    }, [utilisateur]);

    function notifier(message: string) {
        setToast(message);
        setTimeout(() => setToast(''), 2600);
    }

    function messagesDe(err: unknown): string[] {
        return err instanceof ErreurApi ? err.messages : ['Une erreur est survenue. Réessayez.'];
    }

    function piecesPresentes(): TypePiece[] {
        return (demande?.pieces ?? []).map((p) => p.type);
    }

    async function choisirFichier(type: TypePiece, f: File | undefined) {
        if (!f) return;
        const probleme = verifierFichier(f);
        setErreursPieces((p) => ({ ...p, [type]: probleme ?? undefined }));
        if (probleme) return;

        setEnCours(true);
        try {
            // Les pièces se rattachent à un brouillon : on le crée au besoin.
            if (!demande) {
                setDemande(await api<Demande>('/demandes/brouillon', { method: 'PUT', body: JSON.stringify(formulaire) }));
            }
            const corps = new FormData();
            corps.append('fichier', f);
            setDemande(await api<Demande>(`/demandes/courante/pieces/${type}`, { method: 'PUT', body: corps }));
            notifier('Pièce enregistrée.');
        } catch (err) {
            setErreursPieces((p) => ({ ...p, [type]: messagesDe(err).join(' ') }));
        } finally {
            setEnCours(false);
        }
    }
    async function enregistrerBrouillon() {
        setEnCours(true);
        setErreurs([]);
        try {
            const d = await api<Demande>('/demandes/brouillon', { method: 'PUT', body: JSON.stringify(formulaire) });
            setDemande(d);
            notifier('Brouillon enregistré.');
        } catch (err) {
            setErreurs(messagesDe(err));
        } finally {
            setEnCours(false);
        }
    }

    async function telechargerCertificat() {
        try {
            enregistrerFichier(
                await telecharger('/demandes/courante/certificat'),
                `certificat-${demande?.numeroDossier ?? 'nationalite'}.pdf`,
            );
        } catch (e) {
            notifier(e instanceof Error ? e.message : 'Téléchargement impossible.');
        }
    }

    async function soumettre() {
        const e = verifierDossier(formulaire, piecesPresentes());
        setErreurs(e);
        if (e.length > 0) return;
        setEnCours(true);
        try {
            // Le serveur soumet ce qu'il a enregistré : on sauvegarde d'abord le formulaire.
            await api<Demande>('/demandes/brouillon', { method: 'PUT', body: JSON.stringify(formulaire) });
            const d = await api<Demande>('/demandes/courante/soumettre', { method: 'POST' });
            setDemande(d);
            notifier('Demande soumise : il reste à régler les frais.');
        } catch (err) {
            setErreurs(messagesDe(err));
        } finally {
            setEnCours(false);
        }
    }

    // TEMPORAIRE : le module paiements du backend n'existe pas encore.
    // Ce changement de statut n'est pas enregistré : un rechargement le fait disparaître.
    // Retourne un message d'erreur, ou null si le serveur a bien enregistré la tentative.
    async function payer(mode: ModePaiement, issue: 'SUCCES' | 'ECHEC', cleIdempotence: string): Promise<string | null> {
        try {
            const d = await api<Demande>('/paiements', {
                method: 'POST',
                body: JSON.stringify({ mode, issue, cleIdempotence }),
            });
            setDemande(d);
            if (d.statut === 'EN_TRAITEMENT') {
                setPaiementOuvert(false);
                notifier('Paiement confirmé : votre dossier est en cours de traitement.');
            }
            return null;
        } catch (err) {
            return messagesDe(err).join(' ');
        }
    }

    function nouvelle() {
        setDemande(null);
        setFormulaire(FORMULAIRE_VIDE);
        setErreurs([]);
        setErreursPieces({});
    }

    function apercu(valeur: string) {
        setErreurs([]);
        if (valeur === 'AUCUNE') { setDemande(null); return; }
        const d = exemple(valeur as StatutDemande);
        setDemande(d);
        setFormulaire(versFormulaire(d));
    }

    if (!utilisateur) return null;

    const statut = demande?.statut;
    const idx = statut ? INDEX_RAIL[statut] : 0;

    return (
        <div className="citoyen">
            <header className="topnav">
                <Link className="brand" href="/">
                    <span className="brand-mark"></span>
                    <span className="brand-name">E-Admin</span>
                </Link>
                <div className="nav-right">
                    {APERCU && (
                        <div className="demo-box">
                            Aperçu (démo)
                            <select value={statut ?? 'AUCUNE'} onChange={(e) => apercu(e.target.value)}>
                                <option value="AUCUNE">Aucune demande</option>
                                <option value="BROUILLON">Brouillon</option>
                                <option value="EN_ATTENTE_PAIEMENT">En attente de paiement</option>
                                <option value="EN_TRAITEMENT">En traitement</option>
                                <option value="VALIDEE">Validée</option>
                                <option value="REJETEE">Rejetée</option>
                                <option value="DOCUMENT_GENERE">Document généré</option>
                            </select>
                        </div>
                    )}
                    <div className="account-pill">
                        <div className="avatar">{utilisateur.prenom.charAt(0)}</div>
                        {utilisateur.prenom} {utilisateur.nom}
                    </div>
                    <button type="button" className="btn" onClick={() => { deconnecter(); router.push('/connexion'); }}>
                        Se déconnecter
                    </button>
                </div>
            </header>

            <div className="rail-wrap">
                <div className="rail">
                    {ETAPES_RAIL.map((label, i) => (
                        <div key={label} className={`rail-step ${i < idx ? 'done' : i === idx ? 'current' : ''}`}>
                            <div className="rail-line"></div>
                            <div className="rail-dot">{i < idx ? '✓' : i + 1}</div>
                            <div className="rail-label">{label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="wrap">
                {chargement && (
                    <div className="card"><p className="desc" style={{ margin: 0 }}>Chargement de votre espace…</p></div>
                )}
                {erreurChargement && <div className="erreurs">{erreurChargement}</div>}

                {!chargement && !erreurChargement && (
                    <>
                        {(!demande || statut === 'BROUILLON') && (
                            <VueFormulaire
                                estBrouillon={statut === 'BROUILLON'}
                                enCours={enCours}
                                formulaire={formulaire}
                                onChange={setFormulaire}
                                piecesServeur={demande?.pieces ?? []}
                                erreursPieces={erreursPieces}
                                erreurs={erreurs}
                                onFichier={choisirFichier}
                                onBrouillon={enregistrerBrouillon}
                                onSoumettre={soumettre}
                            />
                        )}
                        {demande && statut === 'EN_ATTENTE_PAIEMENT' && (
                            <VuePaiement demande={demande} onPayer={() => setPaiementOuvert(true)} />
                        )}
                        {demande && (statut === 'EN_TRAITEMENT' || statut === 'VALIDEE' || statut === 'REJETEE') && (
                            <VueSuivi demande={demande} onNouvelle={nouvelle} />
                        )}
                        {demande && (statut === 'ANNULEE' || statut === 'EXPIREE') && (
                            <VueTerminee demande={demande} onNouvelle={nouvelle} />
                        )}
                        {demande && statut === 'DOCUMENT_GENERE' && (
                            <VueCertificat
                                demande={demande}
                                onTelecharger={telechargerCertificat}                                onNouvelle={nouvelle}
                            />
                        )}
                    </>
                )}
            </div>

            {paiementOuvert && demande && (
                <ModalePaiement
                    paiements={demande.paiements}
                    onPayer={payer}
                    onFermer={() => setPaiementOuvert(false)}
                />
            )}
            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}