const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Utilisateur = {
    id: string;
    email: string;
    role: 'CITOYEN' | 'AGENT' | 'ADMIN';
    nom: string;
    prenom: string;
};

export type ReponseAuth = { token: string; utilisateur: Utilisateur };

export class ErreurApi extends Error {
    messages: string[];
    constructor(messages: string[]) {
        super(messages.join(', '));
        this.messages = messages;
    }
}

function jeton() {
    return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export async function api<T>(chemin: string, options: RequestInit = {}): Promise<T> {
    const token = jeton();
    const estFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const res = await fetch(`${API_URL}${chemin}`, {
        ...options,
        headers: {
            ...(estFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (res.status === 401 && token && typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('utilisateur');
        window.location.href = '/connexion';
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const messages = Array.isArray(data?.message)
            ? (data.message as string[])
            : [data?.message ?? 'Une erreur est survenue'];
        throw new ErreurApi(messages);
    }
    return data as T;
}

// Récupère un fichier protégé (le jeton ne peut pas passer par un simple lien).
export async function telecharger(chemin: string): Promise<Blob> {
    const token = jeton();
    const res = await fetch(`${API_URL}${chemin}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.message === 'string' ? data.message : 'Téléchargement impossible.');
    }
    return res.blob();
}

// Déclenche l'enregistrement d'un fichier récupéré avec le jeton
export function enregistrerFichier(blob: Blob, nom: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}