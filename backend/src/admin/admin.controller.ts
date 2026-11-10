import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { CreerAgentDto } from './dto/creer-agent.dto';
import { StatutAgentDto } from './dto/statut-agent.dto';

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
    creer(@Body() dto: CreerAgentDto) {
        return this.admin.creerAgent(dto);
    }

    @Patch('agents/:id')
    statut(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatutAgentDto) {
        return this.admin.changerStatut(id, dto.actif);
    }
}