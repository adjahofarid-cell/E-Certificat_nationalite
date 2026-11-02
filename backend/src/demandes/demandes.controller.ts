import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BrouillonDto } from '../auth/dto/brouillon.dto';
import { DemandesService } from './demandes.service';

type Requete = { user: { id: string; role: string } };

@Controller('demandes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CITOYEN')
export class DemandesController {
    constructor(private demandes: DemandesService) {}

    @Get('courante')
    courante(@Req() req: Requete) {
        return this.demandes.courante(req.user.id);
    }

    @Put('brouillon')
    brouillon(@Req() req: Requete, @Body() dto: BrouillonDto) {
        return this.demandes.sauvegarderBrouillon(req.user.id, dto);
    }

    @Post('courante/soumettre')
    soumettre(@Req() req: Requete) {
        return this.demandes.soumettre(req.user.id);
    }
}