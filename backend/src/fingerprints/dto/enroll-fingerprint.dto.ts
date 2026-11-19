import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { FingerPosition } from '../../domain/enums';

export class EnrollFingerprintDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  @MinLength(20)
  template!: string;

  @IsOptional()
  @IsEnum(FingerPosition)
  finger?: FingerPosition;

  @IsOptional()
  @IsString()
  deviceModel?: string;
}
