import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreerAgentDto {
    @IsString() @IsNotEmpty({ message: 'Le prénom est obligatoire.' }) @MaxLength(80) prenom: string;
    @IsString() @IsNotEmpty({ message: 'Le nom est obligatoire.' }) @MaxLength(80) nom: string;
    @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email: string;
    @IsOptional() @IsString() @MaxLength(30) telephone?: string;
    @IsString()
    @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
    @MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères.' })
    motDePasse: string;
}