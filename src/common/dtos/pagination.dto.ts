import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number) //esto es lo mismo que habilitar en el GlobalPipes de main.ts el "enableImplicitConversions: true"
  limit?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number) //esto es lo mismo que habilitar en el GlobalPipes de main.ts el "enableImplicitConversions: true"
  offset?: number;
}
