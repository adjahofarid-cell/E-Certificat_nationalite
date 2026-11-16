import { IsString, MaxLength, MinLength } from 'class-validator';

export class RevoquerDto {
    @IsString()
    @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères.' })
    @MaxLength(300, { message: 'Le motif ne peut pas dépasser 300 caractères.' })
    motif: string;
}