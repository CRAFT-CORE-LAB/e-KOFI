import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(2)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/, {
    message: 'Student ID must be 2 to 32 letters, numbers, dots, dashes, or underscores',
  })
  studentCode!: string;

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
