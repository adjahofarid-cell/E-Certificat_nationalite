import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString() @IsNotEmpty() nom: string;
    @IsString() @IsNotEmpty() prenom: string;
    @IsEmail() email: string;
    @IsOptional() @IsString() telephone?: string;
    @IsString() @MinLength(8) motDePasse: string;
}