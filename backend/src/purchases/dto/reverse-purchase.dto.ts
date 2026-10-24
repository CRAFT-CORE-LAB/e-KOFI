import { IsOptional, IsString, MinLength } from 'class-validator';

export class ReversePurchaseDto {
  @IsString()
  @MinLength(8)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
