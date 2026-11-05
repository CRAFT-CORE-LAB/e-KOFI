import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min, MinLength } from 'class-validator';

export class CreatePurchaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountRwf!: number;

  @IsUUID()
  canteenId!: string;

  @IsUUID()
  studentId!: string;

  @IsOptional()
  @Matches(/^\d{4,6}$/)
  pin?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  identifiedBy?: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
