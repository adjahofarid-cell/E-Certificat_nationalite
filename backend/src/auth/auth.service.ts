import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {}

    async register(dto: RegisterDto) {
        const existant = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
        if (existant) throw new ConflictException('Cet email est déjà utilisé');

        const motDePasse = await bcrypt.hash(dto.motDePasse, 10);
        const user = await this.prisma.utilisateur.create({
            data: {
                nom: dto.nom,
                prenom: dto.prenom,
                email: dto.email,
                telephone: dto.telephone,
                motDePasse,
                // le rôle CITOYEN est forcé par le défaut du schéma
            },
        });
        return this.reponse(user);
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.utilisateur.findUnique({ where: { email: dto.email } });
        const ok = user && (await bcrypt.compare(dto.motDePasse, user.motDePasse));
        if (!user || !ok || !user.actif) {
            // Seuls les refus sur un compte existant sont journalisés. Le client, lui, reçoit toujours le même message.
            if (user) {
                await this.audit.enregistrer('CONNEXION_ECHEC', {
                    acteurId: user.id,
                    detail: !ok ? 'Mot de passe incorrect' : 'Compte désactivé',
                });
            }
            throw new UnauthorizedException('Identifiants invalides');
        }
        await this.audit.enregistrer('CONNEXION', { acteurId: user.id });
        return this.reponse(user);
    }

    private reponse(user: { id: string; email: string; role: string; nom: string; prenom: string }) {
        const token = this.jwt.sign({ sub: user.id, role: user.role });
        return {
            token,
            utilisateur: { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
        };
    }
}