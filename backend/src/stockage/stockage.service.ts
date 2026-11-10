import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

@Injectable()
export class StockageService {
    private racine: string;

    constructor(config: ConfigService) {
        this.racine = resolve(config.get<string>('STOCKAGE_DIR') ?? './stockage');
    }

    // Refuse toute clé qui sortirait du dossier de stockage (ex. « ../../.env »).
    private chemin(cle: string) {
        const complet = resolve(this.racine, cle);
        if (!complet.startsWith(this.racine + sep)) throw new Error('Clé de stockage invalide');
        return complet;
    }

    async enregistrer(cle: string, contenu: Buffer) {
        const c = this.chemin(cle);
        await mkdir(dirname(c), { recursive: true });
        await writeFile(c, contenu);
    }

    lire(cle: string) {
        return readFile(this.chemin(cle));
    }

    async supprimer(cle: string) {
        await rm(this.chemin(cle), { force: true });
    }
}