import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DocumentsService } from './documents.service';

@Controller('verification')
@UseGuards(ThrottlerGuard)
export class VerificationController {
    constructor(private documents: DocumentsService) {}

    @Get(':identifiant')
    verifier(@Param('identifiant') identifiant: string) {
        return this.documents.verifier(identifiant);
    }
}