'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Utilisateur } from '@/lib/api';
import { cheminSelonRole, lireUtilisateur } from '@/lib/session';
import './accueil.css';

function Icone({ children }: { children: React.ReactNode }) {
  return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
  );
}

const ETAPES = [
  {
    titre: 'Création du compte',
    texte: 'Inscrivez-vous avec votre adresse e-mail. Vous pouvez ensuite consulter et modifier votre profil.',
    icone: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M22 11h-6" /></>),
  },
  {
    titre: 'Dépôt du dossier',
    texte: 'Remplissez le formulaire et joignez les pièces : pièce d’identité, acte de naissance, justificatif de domicile et photo d’identité (PDF, JPG ou PNG, 5 Mo maximum).',
    icone: (<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />),
  },
  {
    titre: 'Paiement des frais',
    texte: 'Réglez les frais de dossier (10 000 XAF) par Mobile Money ou carte VISA. Dans cette version de démonstration, le paiements est simulé : aucune transaction réelle n’est effectuée.',
    icone: (<><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" /></>),
  },
  {
    titre: 'Examen par un agent',
    texte: 'Un agent prend en charge votre dossier, contrôle les pièces, puis le valide ou le rejette avec un motif. Vous suivez le statut dans votre espace.',
    icone: (<><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></>),
  },
  {
    titre: 'Téléchargement du certificat',
    texte: 'Une fois le certificat signé par l’autorité compétente et enregistré, vous le téléchargez depuis votre espace.',
    icone: (<><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /></>),
  },
];

const STATS = [
  { nombre: '10 000 XAF', libelle: 'frais de dossier (paiements simulé)' },
  { nombre: '4 pièces', libelle: 'obligatoires pour le dossier' },
  { nombre: '5 Mo', libelle: 'maximum par fichier (PDF, JPG, PNG)' },
  { nombre: 'QR Code', libelle: 'pour vérifier un certificat' },
];

const FAQ = [
  {
    q: 'Qui peut faire une demande ?',
    r: 'Toute personne en possession d’une pièce d’identité en cours de validité (CNI ou passeport) peut créer un compte et déposer une demande.',
  },
  {
    q: 'Combien coûte le certificat ?',
    r: 'Les frais de dossier sont fixés à 10 000 XAF. Dans cette version de démonstration, le paiements est simulé : aucune transaction réelle n’est effectuée et aucune donnée bancaire n’est saisie.',
  },
  {
    q: 'Combien de temps dure le traitement ?',
    r: 'Il dépend de l’examen de votre dossier par un agent. Vous suivez le statut de votre demande en permanence depuis votre espace.',
  },
  {
    q: 'Puis-je déposer plusieurs demandes ?',
    r: 'Une seule demande peut être active à la fois. Vous pouvez en créer une nouvelle lorsque la précédente est rejetée, annulée, expirée ou terminée.',
  },
  {
    q: 'Que se passe-t-il si ma demande est rejetée ?',
    r: 'L’agent indique un motif, que vous consultez dans votre espace. Vous pouvez ensuite déposer une nouvelle demande.',
  },
  {
    q: 'Comment vérifier l’authenticité d’un certificat ?',
    r: 'Scannez le QR Code du document ou saisissez son identifiant public dans la section « Vérifier un document ». La vérification est technique et ne garantit pas à elle seule la valeur juridique du document.',
  },
];

export default function Accueil() {
  const router = useRouter();
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [faqOuverte, setFaqOuverte] = useState<number | null>(null);
  const [idPublic, setIdPublic] = useState('');

  useEffect(() => {
    setUtilisateur(lireUtilisateur());
  }, []);

  const lienEspace = utilisateur ? cheminSelonRole(utilisateur.role) : '/connexion';
  const lienDemande = utilisateur ? cheminSelonRole(utilisateur.role) : '/connexion#inscription';

  function verifier(e: React.FormEvent) {
    e.preventDefault();
    const id = idPublic.trim();
    if (id) router.push(`/verification/${encodeURIComponent(id)}`);
  }

  return (
      <>
        <nav className="nav">
          <Link className="brand" href="/">
            <span className="brand-mark"></span>
            <span className="brand-name">E-Admin</span>
          </Link>
          <div className="nav-links">
            <a href="#comment-ca-marche">Comment ça marche</a>
            <a href="#verification">Vérifier un document</a>
            <a href="#services">Services</a>
            {utilisateur ? (
                <Link className="btn btn-primary" href={lienEspace}>Mon espace</Link>
            ) : (
                <>
                  <Link className="btn btn-outline" href="/connexion">Se connecter</Link>
                  <Link className="btn btn-primary" href="/connexion#inscription">Créer un compte</Link>
                </>
            )}
          </div>
        </nav>

        <section className="hero">
          <div className="decor one"></div>
          <div className="decor two"></div>
          <div className="hero-content">
            <h1>Vos démarches administratives,<br />simplifiées et entièrement en ligne</h1>
            <p>
              Demandez votre certificat de nationalité, suivez votre dossier en temps réel et
              téléchargez votre certificat signé sans vous déplacer au guichet.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={lienDemande}>Commencer une demande</Link>
              <a className="btn secondary" href="#comment-ca-marche">Voir le parcours</a>
            </div>
          </div>
        </section>

        <div className="stats">
          {STATS.map((s) => (
              <div className="stat" key={s.nombre}>
                <div className="stat-number">{s.nombre}</div>
                <div className="stat-label">{s.libelle}</div>
              </div>
          ))}
        </div>

        <section id="comment-ca-marche" className="section">
          <div className="section-heading">
            <div className="eyebrow">Comment ça marche</div>
            <h2>5 étapes, de chez vous</h2>
            <p>Le parcours est guidé étape par étape. Vous gardez la main sur votre brouillon tant que vous n’avez pas soumis votre dossier.</p>
          </div>
          <div className="steps-container">
            <div className="steps">
              {ETAPES.map((e, i) => (
                  <div className="step" key={e.titre}>
                    {i < ETAPES.length - 1 && <div className="step-line"></div>}
                    <div className="step-icon"><Icone>{e.icone}</Icone></div>
                    <div className="step-content">
                      <div className="step-title">
                        <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                        <span className="step-label">{e.titre}</span>
                      </div>
                      <p className="step-desc">{e.texte}</p>
                    </div>
                  </div>
              ))}
            </div>
            <Image
                src="/images/pexels-dennisshotit-10847164.jpg"
                width={556}
                height={371}
                alt="Un homme devant un ordinateur"
                className="steps-image"
            />
          </div>
        </section>

        <section id="verification" className="verify">
          <div className="section-heading" style={{ marginBottom: 0 }}>
            <div className="eyebrow">Vérification publique</div>
            <h2>Vérifier un document</h2>
            <p>Saisissez l’identifiant public imprimé sur le certificat, ou scannez son QR Code. Aucun compte n’est nécessaire.</p>
          </div>
          <form className="verify-form" onSubmit={verifier}>
            <input
                value={idPublic}
                onChange={(e) => setIdPublic(e.target.value)}
                placeholder="Identifiant public du document"
                aria-label="Identifiant public du document"
            />
            <button type="submit" className="btn btn-primary">Vérifier</button>
          </form>
          <p className="verify-note">
            La vérification est technique et ne garantit pas à elle seule la valeur juridique du document.
          </p>
        </section>

        <section id="services" className="services">
          <div className="section-inner">
            <div className="section-heading" style={{ marginBottom: 32 }}>
              <div className="eyebrow">Services disponibles</div>
              <h2>Catalogue des démarches</h2>
            </div>
            <div className="services-grid">
              <div className="service">
                <span className="service-name">Certificat de nationalité</span>
                <span className="badge green">Disponible</span>
              </div>
              <div className="service">
                <span className="service-name">Vérification d’un certificat</span>
                <span className="badge green">Disponible</span>
              </div>
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="section-heading" style={{ marginBottom: 32 }}>
            <div className="eyebrow">FAQ</div>
            <h2>Questions fréquentes</h2>
          </div>
          <div className="faq-list">
            {FAQ.map((item, i) => {
              const ouverte = faqOuverte === i;
              return (
                  <div className="faq-item" key={item.q}>
                    <button
                        className="faq-question"
                        type="button"
                        aria-expanded={ouverte}
                        onClick={() => setFaqOuverte(ouverte ? null : i)}
                    >
                      <span>{item.q}</span>
                      <span className="faq-plus">{ouverte ? '−' : '+'}</span>
                    </button>
                    {ouverte && <p className="faq-answer">{item.r}</p>}
                  </div>
              );
            })}
          </div>
        </section>

        <section className="cta">
          <h2>Prêt à commencer votre démarche ?</h2>
          <p>Créez votre compte et déposez votre demande de certificat de nationalité en ligne.</p>
          <Link className="btn btn-primary" href={lienDemande}>Créer mon espace personnel</Link>
        </section>

        <footer>
          <div className="footer-brand">
            <span className="footer-mark"></span>
            <span className="footer-name">E-Admin</span>
          </div>
          <div className="footer-links">
            <a href="#">Mentions légales</a>
            <a href="#">Accessibilité</a>
            <a href="#">Contact</a>
            <Link href="/connexion">Espace agent</Link>
          </div>
        </footer>
      </>
  );
}