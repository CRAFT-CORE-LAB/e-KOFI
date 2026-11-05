import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ParentTopUpDto {
  @IsInt()
  @Min(500)
  @Max(500_000)
  amountRwf!: number;

  @IsString()
  @MinLength(9)
  mobilePhone!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
