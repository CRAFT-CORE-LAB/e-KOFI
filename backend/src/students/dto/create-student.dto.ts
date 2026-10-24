import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsUUID()
  schoolId!: string;

  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsBoolean()
  pinEnabled?: boolean;

  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin?: string;
}
