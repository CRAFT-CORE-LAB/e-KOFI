import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min, MinLength } from 'class-validator';

export class CreatePurchaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountRwf!: number;

  @IsUUID()
  canteenId!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Matches(/^[0-9A-Fa-f]{6,32}$/)
  cardUid?: string;

  @IsOptional()
  @IsString()
  @MinLength(16)
  authToken?: string;

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
