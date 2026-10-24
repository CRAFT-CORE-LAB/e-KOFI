import { IsOptional, IsString, MinLength } from 'class-validator';

export class BlockCardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
