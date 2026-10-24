import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class WithdrawCanteenDto {
  @IsInt()
  @Min(100)
  amountRwf!: number;

  @IsString()
  @MinLength(9)
  mobilePhone!: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
