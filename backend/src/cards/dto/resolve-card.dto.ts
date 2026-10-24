import { IsString, Matches, MinLength } from 'class-validator';

export class ResolveCardDto {
  @Matches(/^[0-9A-Fa-f]{6,32}$/, { message: 'cardUid must be a hex NFC UID' })
  cardUid!: string;

  @IsString()
  @MinLength(16)
  authToken!: string;
}
