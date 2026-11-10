'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import './verification.css';

type Resultat =
    | { resultat: 'NON_TROUVE' }
    | { resultat: 'VALIDE' | 'REVOQUE'; apercu: { titre: string; titulaire: string; dateEnregistrement: string | null } };

export default function Verification() {
    const { identifiant } = useParams<{ identifiant: string }>();
    const [res, setRes] = useState<Resultat | null>(null);
    const [erreur, setErreur] = useState('');

    useEffect(() => {
        api<Resultat>(`/verification/${encodeURIComponent(identifiant)}`)
            .then(setRes)
            .catch(() => setErreur('Vérification impossible pour le moment (ou trop de requêtes). Réessayez dans un instant.'));
    }, [identifiant]);

    return (
        <main className="verif">
            <div className="verif-card">
                <Link href="/" className="verif-brand"><span className="verif-mark"></span>E-Admin</Link>
                <h1>Vérification d’un certificat</h1>
                <p className="verif-id">Identifiant : <span className="verif-mono">{identifiant}</span></p>

                {!res && !erreur && <p>Vérification en cours…</p>}
                {erreur && <div className="verif-box rouge">{erreur}</div>}

                {res?.resultat === 'NON_TROUVE' && (
                    <div className="verif-box gris">
                        <strong>Aucun document trouvé</strong>
                        <p>Aucun certificat ne correspond à cet identifiant. Vérifiez la saisie ou le QR Code.</p>
                    </div>
                )}

                {res && res.resultat !== 'NON_TROUVE' && (
                    <div className={`verif-box ${res.resultat === 'VALIDE' ? 'vert' : 'rouge'}`}>
                        <strong>{res.resultat === 'VALIDE' ? 'Document enregistré et valide' : 'RÉVOQUÉ : ce document n’est plus valide'}</strong>
                        <dl>
                            <div><dt>Document</dt><dd>{res.apercu.titre}</dd></div>
                            <div><dt>Titulaire</dt><dd>{res.apercu.titulaire}</dd></div>
                            <div>
                                <dt>Enregistré le</dt>
                                <dd>{res.apercu.dateEnregistrement ? new Date(res.apercu.dateEnregistrement).toLocaleDateString('fr-FR') : '—'}</dd>
                            </div>
                        </dl>
                    </div>
                )}

                <p className="verif-note">
                    Cette vérification est technique : elle confirme l’enregistrement du document dans E-Admin et
                    ne garantit pas à elle seule sa valeur juridique.
                </p>
            </div>
        </main>
    );
}