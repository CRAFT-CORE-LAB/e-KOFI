import { IsString, MinLength } from 'class-validator';

export class StudentRegisterDto {
  @IsString()
  @MinLength(2)
  studentCode!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
