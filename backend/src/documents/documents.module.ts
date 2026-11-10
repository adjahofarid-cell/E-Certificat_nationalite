import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentsService } from './documents.service';
import { VerificationController } from './verification.controller';

@Module({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
    controllers: [VerificationController],
    providers: [DocumentsService],
    exports: [DocumentsService],
})
export class DocumentsModule {}