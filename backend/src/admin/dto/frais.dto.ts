import { IsInt, Max, Min } from 'class-validator';

export class FraisDto {
    @IsInt({ message: 'Le montant doit être un nombre entier.' })
    @Min(100, { message: 'Le montant minimal est de 100 XAF.' })
    @Max(10_000_000, { message: 'Le montant maximal est de 10 000 000 XAF.' })
    montant: number;
}