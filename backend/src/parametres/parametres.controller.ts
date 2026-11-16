import { Controller, Get } from '@nestjs/common';
import { ParametresService } from './parametres.service';

@Controller('parametres')
export class ParametresController {
    constructor(private parametres: ParametresService) {}

    @Get('frais')
    async frais() {
        return { montant: await this.parametres.montantFrais(), devise: 'XAF' };
    }
}