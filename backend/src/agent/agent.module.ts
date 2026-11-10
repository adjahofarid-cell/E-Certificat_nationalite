import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import {DocumentsModule} from "../documents/documents.module";

@Module({
    controllers: [AgentController],
    providers: [AgentService],
    imports: [DocumentsModule],
})
export class AgentModule {}