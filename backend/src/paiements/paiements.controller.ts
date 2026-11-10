import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaiementDto } from './dto/paiement.dto';
import { PaiementsService } from './paiements.service';

type Requete = { user: { id: string; role: string } };

@Controller('paiements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CITOYEN')
export class PaiementsController {
    constructor(private paiements: PaiementsService) {}

    @Post()
    payer(@Req() req: Requete, @Body() dto: PaiementDto) {
        return this.paiements.payer(req.user.id, dto);
    }
}