import { IsIn, IsUUID } from 'class-validator';

export class PaiementDto {
    @IsIn(['MOBILE_MONEY', 'VISA']) mode: 'MOBILE_MONEY' | 'VISA';
    @IsIn(['SUCCES', 'ECHEC']) issue: 'SUCCES' | 'ECHEC';
    @IsUUID() cleIdempotence: string;
}