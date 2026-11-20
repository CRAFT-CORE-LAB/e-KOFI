import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LinkGuardianDto {
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
