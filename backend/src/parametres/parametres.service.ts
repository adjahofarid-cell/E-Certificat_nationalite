import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CLE_FRAIS = 'MONTANT_FRAIS';
const FRAIS_PAR_DEFAUT = 10000;

@Injectable()
export class ParametresService {
    constructor(private prisma: PrismaService) {}

    async montantFrais(): Promise<number> {
        const p = await this.prisma.parametre.findUnique({ where: { cle: CLE_FRAIS } });
        const n = p ? parseInt(p.valeur, 10) : NaN;
        return Number.isInteger(n) && n > 0 ? n : FRAIS_PAR_DEFAUT;
    }

    async definirMontantFrais(montant: number) {
        await this.prisma.parametre.upsert({
            where: { cle: CLE_FRAIS },
            update: { valeur: String(montant) },
            create: { cle: CLE_FRAIS, valeur: String(montant) },
        });
    }
}