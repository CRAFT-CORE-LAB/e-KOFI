import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$/, {
    message: 'Student ID must be 2 to 32 letters, numbers, dots, dashes, or underscores',
  })
  studentCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsBoolean()
  pinEnabled?: boolean;

  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4 to 6 digits' })
  pin?: string;
}
