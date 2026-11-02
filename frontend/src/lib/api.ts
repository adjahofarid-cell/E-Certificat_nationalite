const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Utilisateur = {
    id: string;
    email: string;
    role: 'CITOYEN' | 'AGENT' | 'ADMIN';
    nom: string;
    prenom: string;
};

export type ReponseAuth = { token: string; utilisateur: Utilisateur };

export async function api<T>(chemin: string, options: RequestInit = {}): Promise<T> {
    const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const res = await fetch(`${API_URL}${chemin}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message ?? 'Une erreur est survenue';
        throw new Error(message);
    }
    return data as T;
}