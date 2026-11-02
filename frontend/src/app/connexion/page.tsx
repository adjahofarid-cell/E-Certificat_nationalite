'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ReponseAuth } from '@/lib/api';
import { cheminSelonRole, enregistrerSession } from '@/lib/session';

function ChampMotDePasse(props: {
    valeur: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete: string;
}) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="pw-wrap">
            <input
                type={visible ? 'text' : 'password'}
                value={props.valeur}
                onChange={(e) => props.onChange(e.target.value)}
                placeholder={props.placeholder}
                autoComplete={props.autoComplete}
            />
            <button
                type="button"
                className="pw-toggle"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {visible ? (
                        <>
                            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                            <path d="m2 2 20 20" />
                        </>
                    ) : (
                        <>
                            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                            <circle cx="12" cy="12" r="3" />
                        </>
                    )}
                </svg>
            </button>
        </div>
    );
}

export default function Connexion() {
    const router = useRouter();
    const [onglet, setOnglet] = useState<'login' | 'signup'>('login');
    const [erreurServeur, setErreurServeur] = useState('');
    const [chargement, setChargement] = useState(false);

    // Connexion
    const [lEmail, setLEmail] = useState('');
    const [lMdp, setLMdp] = useState('');
    const [lErreurs, setLErreurs] = useState({ email: false, mdp: false });

    // Inscription
    const [s, setS] = useState({ prenom: '', nom: '', email: '', telephone: '', mdp: '', mdp2: '' });
    const [sErreurs, setSErreurs] = useState({ nom: false, email: false, mdp: false });

    function changerOnglet(o: 'login' | 'signup') {
        setOnglet(o);
        setErreurServeur('');
    }

    async function terminer(chemin: string, corps: object) {
        setErreurServeur('');
        setChargement(true);
        try {
            const reponse = await api<ReponseAuth>(chemin, { method: 'POST', body: JSON.stringify(corps) });
            enregistrerSession(reponse);
            router.push(cheminSelonRole(reponse.utilisateur.role));
        } catch (err) {
            setErreurServeur(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setChargement(false);
        }
    }

    function envoyerConnexion(e: React.FormEvent) {
        e.preventDefault();
        const erreurs = { email: !lEmail.trim(), mdp: !lMdp };
        setLErreurs(erreurs);
        if (erreurs.email || erreurs.mdp) return;
        terminer('/auth/login', { email: lEmail.trim(), motDePasse: lMdp });
    }

    function envoyerInscription(e: React.FormEvent) {
        e.preventDefault();
        const erreurs = {
            nom: !s.nom.trim() || !s.prenom.trim(),
            email: !s.email.includes('@'),
            mdp: s.mdp.length < 8 || s.mdp !== s.mdp2,
        };
        setSErreurs(erreurs);
        if (erreurs.nom || erreurs.email || erreurs.mdp) return;
        terminer('/auth/register', {
            nom: s.nom.trim(),
            prenom: s.prenom.trim(),
            email: s.email.trim(),
            telephone: s.telephone.trim() || undefined,
            motDePasse: s.mdp,
        });
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="brand-center">
                    <div className="brand-mark-lg" />
                    <div className="brand-name">E-Admin</div>
                </div>

                <div className="tabs">
                    <button type="button" className={`tab ${onglet === 'login' ? 'active' : ''}`} onClick={() => changerOnglet('login')}>
                        Se connecter
                    </button>
                    <button type="button" className={`tab ${onglet === 'signup' ? 'active' : ''}`} onClick={() => changerOnglet('signup')}>
                        Créer un compte
                    </button>
                </div>

                {erreurServeur && <div className="form-error">{erreurServeur}</div>}

                {onglet === 'login' ? (
                    <form onSubmit={envoyerConnexion} noValidate>
                        <label className="field">
                            <span>Adresse email</span>
                            <input type="email" value={lEmail} onChange={(e) => setLEmail(e.target.value)}
                                   placeholder="vous@exemple.com" autoComplete="email" />
                        </label>
                        {lErreurs.email && <div className="field-error">Merci de renseigner votre email.</div>}

                        <label className="field">
                            <span>Mot de passe</span>
                            <ChampMotDePasse valeur={lMdp} onChange={setLMdp} placeholder="••••••••" autoComplete="current-password" />
                        </label>
                        {lErreurs.mdp && <div className="field-error">Merci de renseigner votre mot de passe.</div>}

                        <button type="submit" className="btn primary" disabled={chargement}>
                            {chargement ? 'Connexion...' : 'Se connecter'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={envoyerInscription} noValidate>
                        <div className="two-col">
                            <label className="field">
                                <span>Prénom</span>
                                <input type="text" value={s.prenom} onChange={(e) => setS({ ...s, prenom: e.target.value })} />
                            </label>
                            <label className="field">
                                <span>Nom</span>
                                <input type="text" value={s.nom} onChange={(e) => setS({ ...s, nom: e.target.value })} />
                            </label>
                        </div>
                        {sErreurs.nom && <div className="field-error">Merci de renseigner votre nom et prénom.</div>}

                        <label className="field">
                            <span>Adresse email</span>
                            <input type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })}
                                   placeholder="vous@exemple.com" autoComplete="email" />
                        </label>
                        {sErreurs.email && <div className="field-error">Merci de renseigner un email valide.</div>}

                        <label className="field">
                            <span>Téléphone (facultatif)</span>
                            <input type="tel" value={s.telephone} onChange={(e) => setS({ ...s, telephone: e.target.value })}
                                   placeholder="+241 ..." />
                        </label>

                        <label className="field">
                            <span>Mot de passe</span>
                            <ChampMotDePasse valeur={s.mdp} onChange={(v) => setS({ ...s, mdp: v })}
                                             placeholder="8 caractères minimum" autoComplete="new-password" />
                        </label>

                        <label className="field">
                            <span>Confirmer le mot de passe</span>
                            <ChampMotDePasse valeur={s.mdp2} onChange={(v) => setS({ ...s, mdp2: v })}
                                             placeholder="••••••••" autoComplete="new-password" />
                        </label>
                        {sErreurs.mdp && (
                            <div className="field-error">Les mots de passe doivent correspondre (8 caractères minimum).</div>
                        )}

                        <button type="submit" className="btn primary" style={{ marginTop: 4 }} disabled={chargement}>
                            {chargement ? 'Création...' : 'Créer mon compte'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}