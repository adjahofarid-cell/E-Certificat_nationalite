import { Module } from '@nestjs/common';
import { DemandesController } from './demandes.controller';
import { DemandesService } from './demandes.service';
import { PiecesService } from './pieces.service';
import {StockageModule} from "../stockage/stockage.module";
import {DocumentsModule} from "../documents/documents.module";

@Module({
    controllers: [DemandesController],
    providers: [DemandesService, PiecesService],
    imports: [StockageModule, DocumentsModule],
    exports: [DemandesService],
})
export class DemandesModule {}

