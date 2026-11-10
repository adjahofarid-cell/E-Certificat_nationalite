import {
    Body, Controller, Get, Param, ParseEnumPipe, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors, Res, StreamableFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TypePiece } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BrouillonDto } from './dto/brouillon.dto';
import { DemandesService } from './demandes.service';
import { PiecesService } from './pieces.service';
import { TAILLE_MAX } from './type-fichier';
import type { Response } from 'express';
import { DocumentsService } from '../documents/documents.service';

type Requete = { user: { id: string; role: string } };

@Controller('demandes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CITOYEN')
export class DemandesController {
    constructor(private demandes: DemandesService, private pieces: PiecesService, private documents: DocumentsService,) {}

    @Get('courante')
    courante(@Req() req: Requete) {
        return this.demandes.courante(req.user.id);
    }

    @Put('brouillon')
    brouillon(@Req() req: Requete, @Body() dto: BrouillonDto) {
        return this.demandes.sauvegarderBrouillon(req.user.id, dto);
    }

    @Put('courante/pieces/:type')
    @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX, files: 1 } }))
    piece(
        @Req() req: Requete,
        @Param('type', new ParseEnumPipe(TypePiece)) type: TypePiece,
        @UploadedFile() fichier: Express.Multer.File | undefined,
    ) {
        return this.pieces.deposer(req.user.id, type, fichier);
    }

    @Post('courante/soumettre')
    soumettre(@Req() req: Requete) {
        return this.demandes.soumettre(req.user.id);
    }

    @Get('courante/certificat')
    async certificat(@Req() req: Requete, @Res({ passthrough: true }) res: Response) {
        const buffer = await this.documents.lireSigne(req.user.id);
        res.set('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(buffer, {
            type: 'application/pdf',
            disposition: 'attachment; filename="certificat-de-nationalite.pdf"',
        });
    }
}