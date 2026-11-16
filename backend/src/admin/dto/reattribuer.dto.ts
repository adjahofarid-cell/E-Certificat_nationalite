import { IsOptional, IsUUID } from 'class-validator';

export class ReattribuerDto {
    @IsOptional() @IsUUID() agentId?: string;
}