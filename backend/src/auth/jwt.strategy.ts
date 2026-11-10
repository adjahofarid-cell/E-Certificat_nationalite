import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(config: ConfigService, private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get<string>('JWT_SECRET') as string,
        });
    }

    // Appelé à chaque requête protégée : la base fait foi, pas le contenu du jeton.
    async validate(payload: { sub: string }) {
        const u = await this.prisma.utilisateur.findUnique({
            where: { id: payload.sub },
            select: { id: true, role: true, actif: true },
        });
        if (!u || !u.actif) throw new UnauthorizedException();
        return { id: u.id, role: u.role };
    }
}