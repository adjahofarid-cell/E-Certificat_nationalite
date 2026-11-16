import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, Put } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { CreerAgentDto } from './dto/creer-agent.dto';
import { JournalQueryDto } from './dto/journal.dto';
import { StatutAgentDto } from './dto/statut-agent.dto';
import { FraisDto } from './dto/frais.dto';
import { ReattribuerDto } from './dto/reattribuer.dto';
import { RevoquerDto } from './dto/revoquer.dto';

type Requete = { user: { id: string; role: string } };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
    constructor(private admin: AdminService) {}

    @Get('agents')
    agents() {
        return this.admin.agents();
    }

    @Post('agents')
    creer(@Req() req: Requete, @Body() dto: CreerAgentDto) {
        return this.admin.creerAgent(dto, req.user.id);
    }

    @Patch('agents/:id')
    statut(@Req() req: Requete, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatutAgentDto) {
        return this.admin.changerStatut(id, dto.actif, req.user.id);
    }

    @Get('journal')
    journal(@Query() q: JournalQueryDto) {
        return this.admin.journal(q.action, q.page);
    }

    @Get('demandes')
    demandes() {
        return this.admin.demandes();
    }

    @Get('demandes/:id')
    demande(@Param('id', ParseUUIDPipe) id: string) {
        return this.admin.demande(id);
    }

    @Post('demandes/:id/reattribuer')
    reattribuer(@Req() req: Requete, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReattribuerDto) {
        return this.admin.reattribuer(id, dto.agentId, req.user.id);
    }

    @Post('demandes/:id/revoquer')
    revoquer(@Req() req: Requete, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevoquerDto) {
        return this.admin.revoquer(id, dto.motif, req.user.id);
    }

    @Get('statistiques')
    statistiques() {
        return this.admin.statistiques();
    }

    @Put('frais')
    frais(@Req() req: Requete, @Body() dto: FraisDto) {
        return this.admin.changerFrais(dto.montant, req.user.id);
    }
}