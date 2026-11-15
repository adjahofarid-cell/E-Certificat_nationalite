import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { CreerAgentDto } from './dto/creer-agent.dto';
import { JournalQueryDto } from './dto/journal.dto';
import { StatutAgentDto } from './dto/statut-agent.dto';

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
}