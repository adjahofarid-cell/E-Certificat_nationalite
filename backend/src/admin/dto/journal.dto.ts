import { IsEnum, IsOptional, Matches } from 'class-validator';
import { ActionAudit } from '../../../generated/prisma/client';

export class JournalQueryDto {
    @IsOptional() @IsEnum(ActionAudit, { message: 'Action inconnue.' }) action?: ActionAudit;
    @IsOptional() @Matches(/^\d{1,6}$/, { message: 'Numéro de page invalide.' }) page?: string;
}