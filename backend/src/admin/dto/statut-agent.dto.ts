import { IsBoolean } from 'class-validator';

export class StatutAgentDto {
    @IsBoolean({ message: 'Le champ « actif » doit être vrai ou faux.' }) actif: boolean;
}