import { IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class RegisterCardDto {
  @IsUUID()
  studentId!: string;

  @Matches(/^[0-9A-Fa-f]{6,32}$/, { message: 'cardUid must be a hex NFC UID' })
  cardUid!: string;

  @IsOptional()
  @IsString()
  @MinLength(16)
  authToken?: string;
}
