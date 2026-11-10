import { Module } from '@nestjs/common';
import { DemandesModule } from '../demandes/demandes.module';
import { PaiementsController } from './paiements.controller';
import { PaiementsService } from './paiements.service';

@Module({
    imports: [DemandesModule],
    controllers: [PaiementsController],
    providers: [PaiementsService],
})
export class PaiementsModule {}