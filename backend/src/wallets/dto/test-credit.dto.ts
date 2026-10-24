import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class TestCreditDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountRwf!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  idempotencyKey?: string;
}
