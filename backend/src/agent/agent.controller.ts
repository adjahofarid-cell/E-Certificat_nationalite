import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AgentService } from './agent.service';
import { RejetDto } from './dto/rejet.dto';
import { ParseEnumPipe, Res, StreamableFile, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { TypePiece } from '../../generated/prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { TAILLE_MAX_SIGNE } from '../documents/documents.service';

type Requete = { user: { id: string; role: string } };

@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT')
export class AgentController {
    constructor(private agent: AgentService) {}

    @Get('demandes')
    file() {
        return this.agent.file();
    }

    @Get('motifs')
    motifs() {
        return this.agent.motifs();
    }

    @Get('demandes/:id')
    detail(@Param('id', ParseUUIDPipe) id: string) {
        return this.agent.detail(id);
    }

    @Post('demandes/:id/prendre')
    prendre(@Param('id', ParseUUIDPipe) id: string, @Req() req: Requete) {
        return this.agent.prendre(id, req.user.id);
    }

    @Post('demandes/:id/valider')
    valider(@Param('id', ParseUUIDPipe) id: string, @Req() req: Requete) {
        return this.agent.valider(id, req.user.id);
    }

    @Post('demandes/:id/rejeter')
    rejeter(@Param('id', ParseUUIDPipe) id: string, @Req() req: Requete, @Body() dto: RejetDto) {
        return this.agent.rejeter(id, req.user.id, dto.motifId);
    }

    @Get('demandes/:id/pieces/:type')
    async piece(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('type', new ParseEnumPipe(TypePiece)) type: TypePiece,
        @Res({ passthrough: true }) res: Response,
    ) {
        const { buffer, typeMime, nomFichier } = await this.agent.lirePiece(id, type);
        res.set('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(buffer, {
            type: typeMime,
            disposition: `inline; filename*=UTF-8''${encodeURIComponent(nomFichier)}`,
        });
    }

    @Post('demandes/:id/projet')
    genererProjet(@Param('id', ParseUUIDPipe) id: string, @Req() req: Requete) {
        return this.agent.genererProjet(id, req.user.id);
    }

    @Get('demandes/:id/projet')
    async projet(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: Requete,
        @Res({ passthrough: true }) res: Response,
    ) {
        const buffer = await this.agent.projet(id, req.user.id);
        res.set('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(buffer, {
            type: 'application/pdf',
            disposition: 'attachment; filename="projet-certificat.pdf"',
        });
    }

    @Put('demandes/:id/document-signe')
    @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_SIGNE, files: 1 } }))
    enregistrerSigne(
        @Param('id', ParseUUIDPipe) id: string,
        @Req() req: Requete,
        @UploadedFile() fichier: Express.Multer.File | undefined,
    ) {
        return this.agent.enregistrerSigne(id, req.user.id, fichier);
    }
}