import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StockageModule } from './stockage/stockage.module';
import { AuthModule } from './auth/auth.module';
import { DemandesModule } from './demandes/demandes.module';
import { DocumentsModule } from './documents/documents.module';
import { AgentModule } from './agent/agent.module';
import { PaiementsModule } from './paiements/paiements.module';
import { AdminModule } from './admin/admin.module';
import { ParametresModule } from './parametres/parametres.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StockageModule,
    AuthModule,
    DemandesModule,
    DocumentsModule,
    AgentModule,
    PaiementsModule,
    AdminModule,
    ParametresModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}