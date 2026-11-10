'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, enregistrerFichier, telecharger, Utilisateur } from '@/lib/api';
import { cheminSelonRole, deconnecter, lireUtilisateur } from '@/lib/session';
import { PIECES, StatutDemande, TypePiece } from '@/lib/demande';
import {
    CLASSE_STATUT, DetailDemande, LIBELLE_STATUT, LigneFile, Motif, formaterDate, formaterDateHeure,
} from '@/lib/agent';
import './agent.css';

type Action = 'prendre' | 'valider' | 'rejeter';

function Panneau(props: {
    detail: DetailDemande;
    moi: string;
    motifs: Motif[];
    motifId: string;
    onMotif: (id: string) => void;
    onVoir: (type: TypePiece) => void;
    erreur: string;
    enCours: boolean;
    onAgir: (a: Action) => void;
    onFermer: () => void;
    onGenerer: () => void;
    onTelechargerProjet: () => void;
    onSigne: (f: File | undefined) => void;
}) {
    const d = props.detail;
    const miens = d.agent?.id === props.moi;
    const enTraitement = d.statut === 'EN_TRAITEMENT';

    return (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onFermer(); }}>
            <aside className="panel" role="dialog" aria-modal="true" aria-label="Détail de la demande">
                <div className="panel-head">
                    <div>
                        <h2>{d.citoyen.prenom} {d.citoyen.nom}</h2>
                        <div className="sub mono">{d.numeroDossier}</div>
                    </div>
                    <button type="button" className="panel-close" aria-label="Fermer" onClick={props.onFermer}>✕</button>
                </div>

                <span className={`badge ${CLASSE_STATUT[d.statut]}`}>{LIBELLE_STATUT[d.statut]}</span>

                <div className="section-label">Citoyen</div>
                <dl className="infos">
                    <div><dt>E-mail</dt><dd>{d.citoyen.email}</dd></div>
                    <div><dt>Téléphone</dt><dd>{d.citoyen.telephone ?? '—'}</dd></div>
                    <div><dt>Déposée le</dt><dd>{formaterDateHeure(d.dateSoumission)}</dd></div>
                </dl>

                <div className="section-label">Informations du formulaire</div>
                <dl className="infos">
                    <div><dt>Date de naissance</dt><dd>{formaterDate(d.dateNaissance)}</dd></div>
                    <div><dt>Lieu de naissance</dt><dd>{d.lieuNaissance ?? '—'}</dd></div>
                    <div><dt>Père</dt><dd>{d.nomPere ?? '—'}</dd></div>
                    <div><dt>Mère</dt><dd>{d.nomMere ?? '—'}</dd></div>
                    <div><dt>Adresse</dt><dd>{d.adresse ?? '—'}</dd></div>
                </dl>

                <div className="section-label">Pièces justificatives</div>
                <ul className="pieces-list">
                    {PIECES.map((p) => {
                        const x = d.pieces.find((y) => y.type === p.type);
                        const manquante = !x && p.obligatoire;
                        return (
                            <li key={p.type}>
                                <span className={`ico ${manquante ? 'ko' : 'ok'}`}>{manquante ? '!' : '✓'}</span>
                                <span>
    {p.libelle}
                                    <span className="sub-ligne">
      {x
          ? `${x.nomFichier} · ${(x.taille / 1024 / 1024).toFixed(2)} Mo`
          : p.obligatoire ? 'Manquante' : 'Non fournie (facultative)'}
    </span>
  </span>
                                {x && (
                                    <button type="button" className="link-action" onClick={() => props.onVoir(p.type)}>Voir</button>
                                )}
                            </li>                        );
                    })}
                </ul>

                <div className="section-label">Traitement de la demande</div>

                {enTraitement && !d.agent && (
                    <>
                        <button type="button" className="btn primary block" disabled={props.enCours} onClick={() => props.onAgir('prendre')}>
                            Prendre en charge
                        </button>
                        <p className="hint">
                            Prenez le dossier en charge pour pouvoir le valider ou le rejeter. Les autres agents le
                            verront alors en lecture seule.
                        </p>
                    </>
                )}

                {enTraitement && d.agent && !miens && (
                    <p className="hint" style={{ marginTop: 0 }}>
                        Dossier pris en charge par {d.agent.prenom} {d.agent.nom} : consultation en lecture seule.
                    </p>
                )}

                {enTraitement && miens && (
                    <>
                        <select className="select" value={props.motifId} onChange={(e) => props.onMotif(e.target.value)}>
                            <option value="">Motif de rejet (obligatoire pour rejeter)</option>
                            {props.motifs.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
                        </select>
                        <div className="btn-row">
                            <button type="button" className="btn primary" disabled={props.enCours} onClick={() => props.onAgir('valider')}>
                                Valider la demande
                            </button>
                            <button type="button" className="btn danger" disabled={props.enCours} onClick={() => props.onAgir('rejeter')}>
                                Rejeter
                            </button>
                        </div>
                    </>
                )}

                {d.statut === 'REJETEE' && <div className="note-rejet">Demande rejetée. Motif : {d.motifRejet?.libelle}</div>}

                {props.erreur && <div className="error-msg">{props.erreur}</div>}

                {(d.statut === 'VALIDEE' || d.statut === 'DOCUMENT_GENERE') && (
                    <>
                        <div className="section-label">Certificat</div>

                        {d.statut === 'VALIDEE' && miens && (
                            <>
                                <button type="button" className="btn primary block" disabled={props.enCours} onClick={props.onGenerer}>
                                    {d.document ? '1. Régénérer le projet à signer' : '1. Générer le projet à signer'}
                                </button>
                                {d.document && (
                                    <button type="button" className="btn block" style={{ marginTop: 8 }} disabled={props.enCours} onClick={props.onTelechargerProjet}>
                                        Télécharger le projet (PDF)
                                    </button>
                                )}
                                <label className={`btn block ${d.document && !props.enCours ? '' : 'inactif'}`} style={{ marginTop: 8 }}>
                                    2. Enregistrer le document signé (PDF)
                                    <input
                                        type="file"
                                        hidden
                                        accept="application/pdf,.pdf"
                                        disabled={!d.document || props.enCours}
                                        onChange={(e) => { props.onSigne(e.target.files?.[0]); e.target.value = ''; }}
                                    />
                                </label>
                                <p className="hint">
                                    Générez le projet, téléchargez-le, faites-le signer par l’autorité compétente hors de
                                    l’application, puis enregistrez ici le PDF signé. Son empreinte SHA-256 est calculée à
                                    l’enregistrement.
                                </p>
                            </>
                        )}

                        {d.statut === 'VALIDEE' && !miens && (
                            <p className="hint" style={{ marginTop: 0 }}>Seul l’agent qui a pris en charge le dossier prépare le certificat.</p>
                        )}

                        {d.statut === 'DOCUMENT_GENERE' && d.document && (
                            <dl className="infos">
                                <div><dt>Identifiant public</dt><dd className="mono">{d.document.identifiantPublic}</dd></div>
                                <div><dt>Enregistré le</dt><dd>{formaterDateHeure(d.document.dateEnregistrementSigne)}</dd></div>
                                <div><dt>SHA-256</dt><dd className="mono" style={{ wordBreak: 'break-all' }}>{d.document.hashSigne}</dd></div>
                            </dl>
                        )}
                    </>
                )}
            </aside>
        </div>
    );
}

export default function EspaceAgent() {
    const router = useRouter();
    const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
    const [lignes, setLignes] = useState<LigneFile[]>([]);
    const [motifs, setMotifs] = useState<Motif[]>([]);
    const [chargement, setChargement] = useState(true);
    const [erreurChargement, setErreurChargement] = useState('');
    const [recherche, setRecherche] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [portee, setPortee] = useState<'TOUTES' | 'A_PRENDRE' | 'MIENNES'>('TOUTES');
    const [selection, setSelection] = useState<DetailDemande | null>(null);
    const [motifId, setMotifId] = useState('');
    const [erreurAction, setErreurAction] = useState('');
    const [enCours, setEnCours] = useState(false);
    const [toast, setToast] = useState('');

    useEffect(() => {
        const u = lireUtilisateur();
        if (!u) router.replace('/connexion');
        else if (u.role !== 'AGENT') router.replace(cheminSelonRole(u.role));
        else setUtilisateur(u);
    }, [router]);

    useEffect(() => {
        if (!utilisateur) return;
        Promise.all([api<LigneFile[]>('/agent/demandes'), api<Motif[]>('/agent/motifs')])
            .then(([l, m]) => { setLignes(l); setMotifs(m); })
            .catch((e) => setErreurChargement(e instanceof Error ? e.message : 'Chargement impossible.'))
            .finally(() => setChargement(false));
    }, [utilisateur]);

    function notifier(message: string) {
        setToast(message);
        setTimeout(() => setToast(''), 2600);
    }

    async function ouvrir(id: string) {
        setErreurAction('');
        setMotifId('');
        try {
            setSelection(await api<DetailDemande>(`/agent/demandes/${id}`));
        } catch (e) {
            notifier(e instanceof Error ? e.message : 'Ouverture impossible.');
        }
    }

    async function voirPiece(type: TypePiece) {
        if (!selection) return;
        // La fenêtre est ouverte tout de suite, pendant le clic : sinon le navigateur la bloque.
        const fenetre = window.open('', '_blank');
        try {
            const blob = await telecharger(`/agent/demandes/${selection.id}/pieces/${type}`);
            const url = URL.createObjectURL(blob);
            if (fenetre) fenetre.location.href = url;
            else notifier('Autorisez les fenêtres pop-up pour afficher la pièce.');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) {
            fenetre?.close();
            notifier(e instanceof Error ? e.message : 'Ouverture impossible.');
        }
    }

    async function agir(action: Action) {
        if (!selection) return;
        if (action === 'rejeter' && !motifId) {
            setErreurAction('Choisissez un motif pour rejeter la demande.');
            return;
        }
        setEnCours(true);
        setErreurAction('');
        try {
            const d = await api<DetailDemande>(`/agent/demandes/${selection.id}/${action}`, {
                method: 'POST',
                body: action === 'rejeter' ? JSON.stringify({ motifId }) : undefined,
            });
            setSelection(d);
            setMotifId('');
            setLignes(await api<LigneFile[]>('/agent/demandes'));
            notifier(
                action === 'prendre' ? 'Dossier pris en charge.'
                    : action === 'valider' ? 'Demande validée.'
                        : 'Demande rejetée : le motif est visible par le citoyen.',
            );
        } catch (e) {
            setErreurAction(e instanceof Error ? e.message : 'Action impossible.');
            // Un autre agent a pu agir entre-temps : on recharge l'état réel.
            try { setSelection(await api<DetailDemande>(`/agent/demandes/${selection.id}`)); } catch { /* ignoré */ }
        } finally {
            setEnCours(false);
        }
    }

    async function executer(travail: () => Promise<DetailDemande>, succes: string) {
        setEnCours(true);
        setErreurAction('');
        try {
            setSelection(await travail());
            setLignes(await api<LigneFile[]>('/agent/demandes'));
            notifier(succes);
        } catch (e) {
            setErreurAction(e instanceof Error ? e.message : 'Action impossible.');
        } finally {
            setEnCours(false);
        }
    }

    function genererProjet() {
        if (!selection) return;
        executer(
            () => api<DetailDemande>(`/agent/demandes/${selection.id}/projet`, { method: 'POST' }),
            'Projet de certificat généré.',
        );
    }

    async function telechargerProjet() {
        if (!selection) return;
        try {
            enregistrerFichier(
                await telecharger(`/agent/demandes/${selection.id}/projet`),
                `projet-${selection.numeroDossier ?? 'certificat'}.pdf`,
            );
        } catch (e) {
            notifier(e instanceof Error ? e.message : 'Téléchargement impossible.');
        }
    }

    function envoyerSigne(f: File | undefined) {
        if (!selection || !f) return;
        if (f.type !== 'application/pdf') { setErreurAction('Le document signé doit être un PDF.'); return; }
        if (f.size > 10 * 1024 * 1024) { setErreurAction('Fichier trop volumineux : 10 Mo maximum.'); return; }
        const corps = new FormData();
        corps.append('fichier', f);
        executer(
            () => api<DetailDemande>(`/agent/demandes/${selection.id}/document-signe`, { method: 'PUT', body: corps }),
            'Certificat signé enregistré.',
        );
    }

    if (!utilisateur) return null;

    const aPrendre = (l: LigneFile) => l.statut === 'EN_TRAITEMENT' && !l.agent;
    const visibles = lignes.filter((l) => {
        const q = recherche.trim().toLowerCase();
        const texte = `${l.citoyen.prenom} ${l.citoyen.nom} ${l.numeroDossier ?? ''}`.toLowerCase();
        if (q && !texte.includes(q)) return false;
        if (filtreStatut && l.statut !== filtreStatut) return false;
        if (portee === 'A_PRENDRE' && !aPrendre(l)) return false;
        if (portee === 'MIENNES' && l.agent?.id !== utilisateur.id) return false;
        return true;
    });

    const nbAPrendre = lignes.filter(aPrendre).length;
    const nbMiens = lignes.filter((l) => l.statut === 'EN_TRAITEMENT' && l.agent?.id === utilisateur.id).length;
    const nb = (s: StatutDemande) => lignes.filter((l) => l.statut === s).length;
    const initiales = `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`;

    return (
        <div className="agent">
            <div className="app">
                <aside className="sidebar">
                    <div className="brand">
                        <div className="brand-mark"></div>
                        <div>
                            <div className="brand-name">E-ADMIN</div>
                            <div className="brand-sub">Espace agent</div>
                        </div>
                    </div>
                    <button type="button" className="nav-item active">
                        Demandes <span className="count">{nbAPrendre}</span>
                    </button>
                    <div className="sidebar-footer">
                        <button type="button" className="nav-item" onClick={() => { deconnecter(); router.push('/connexion'); }}>
                            Déconnexion
                        </button>
                    </div>
                </aside>

                <main className="main">
                    <div className="topbar">
                        <h1>Demandes</h1>
                        <div className="agent-chip">
                            <div className="avatar">{initiales}</div>
                            <span>{utilisateur.prenom} {utilisateur.nom}</span>
                        </div>
                    </div>

                    <div className="content">
                        <div className="kpis">
                            <div className="kpi"><div className="n">{nbAPrendre}</div><div className="l">À prendre en charge</div></div>
                            <div className="kpi"><div className="n">{nbMiens}</div><div className="l">Mes dossiers en cours</div></div>
                            <div className="kpi"><div className="n">{nb('VALIDEE')}</div><div className="l">Validées</div></div>
                            <div className="kpi"><div className="n">{nb('REJETEE')}</div><div className="l">Rejetées</div></div>
                        </div>

                        <div className="toolbar">
                            <input
                                type="text"
                                value={recherche}
                                onChange={(e) => setRecherche(e.target.value)}
                                placeholder="Rechercher un citoyen ou un numéro de dossier"
                            />
                            <select value={portee} onChange={(e) => setPortee(e.target.value as typeof portee)}>
                                <option value="TOUTES">Toutes les demandes</option>
                                <option value="A_PRENDRE">À prendre en charge</option>
                                <option value="MIENNES">Mes dossiers</option>
                            </select>
                            <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
                                <option value="">Tous les statuts</option>
                                <option value="EN_TRAITEMENT">En traitement</option>
                                <option value="VALIDEE">Validée</option>
                                <option value="REJETEE">Rejetée</option>
                                <option value="DOCUMENT_GENERE">Certificat signé</option>
                            </select>
                        </div>

                        {chargement && <div className="empty">Chargement…</div>}
                        {erreurChargement && <div className="error-msg">{erreurChargement}</div>}

                        {!chargement && !erreurChargement && (
                            <>
                                <table>
                                    <thead>
                                    <tr><th>Citoyen</th><th>Déposée le</th><th>Statut</th><th>Agent</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                    {visibles.map((l) => (
                                        <tr key={l.id} onClick={() => ouvrir(l.id)}>
                                            <td>
                                                {l.citoyen.prenom} {l.citoyen.nom}
                                                <div className="ref mono">{l.numeroDossier}</div>
                                            </td>
                                            <td>{formaterDateHeure(l.dateSoumission)}</td>
                                            <td><span className={`badge ${CLASSE_STATUT[l.statut]}`}>{LIBELLE_STATUT[l.statut]}</span></td>
                                            <td>{l.agent ? `${l.agent.prenom} ${l.agent.nom}` : '—'}</td>
                                            <td><button type="button" className="link-action">Voir le détail →</button></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                {visibles.length === 0 && (
                                    <div className="empty">
                                        {lignes.length === 0 ? 'Aucune demande payée pour le moment.' : 'Aucune demande ne correspond à cette recherche.'}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>

            {selection && (
                <Panneau
                    detail={selection}
                    moi={utilisateur.id}
                    motifs={motifs}
                    motifId={motifId}
                    onMotif={setMotifId}
                    onVoir={voirPiece}
                    erreur={erreurAction}
                    enCours={enCours}
                    onAgir={agir}
                    onFermer={() => setSelection(null)}
                    onGenerer={genererProjet}
                    onTelechargerProjet={telechargerProjet}
                    onSigne={envoyerSigne}
                />
            )}
            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}