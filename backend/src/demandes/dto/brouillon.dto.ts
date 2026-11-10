import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

// Un champ vide envoyé par le formulaire est traité comme « non renseigné ».
const videEnUndefined = () => Transform(({ value }) => (value === '' ? undefined : value));

export class BrouillonDto {
    @videEnUndefined() @IsOptional() @IsDateString() dateNaissance?: string;
    @videEnUndefined() @IsOptional() @IsString() @MaxLength(120) lieuNaissance?: string;
    @videEnUndefined() @IsOptional() @IsString() @MaxLength(120) nomPere?: string;
    @videEnUndefined() @IsOptional() @IsString() @MaxLength(120) nomMere?: string;
    @videEnUndefined() @IsOptional() @IsString() @MaxLength(200) adresse?: string;
}