import { IsUUID } from 'class-validator';

export class RejetDto {
    @IsUUID() motifId: string;
}