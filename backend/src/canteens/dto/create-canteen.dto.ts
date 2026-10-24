import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCanteenDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsUUID()
  schoolId!: string;
}
