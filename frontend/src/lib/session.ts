import { ReponseAuth, Utilisateur } from './api';

export function enregistrerSession(reponse: ReponseAuth) {
    localStorage.setItem('token', reponse.token);
    localStorage.setItem('utilisateur', JSON.stringify(reponse.utilisateur));
}

export function lireUtilisateur(): Utilisateur | null {
    const brut = localStorage.getItem('utilisateur');
    return brut ? (JSON.parse(brut) as Utilisateur) : null;
}

export function deconnecter() {
    localStorage.removeItem('token');
    localStorage.removeItem('utilisateur');
}

export function cheminSelonRole(role: Utilisateur['role']) {
    if (role === 'AGENT') return '/agent';
    if (role === 'ADMIN') return '/admin';
    return '/citoyen';
}