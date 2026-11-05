import { IsString, MinLength } from 'class-validator';

export class StudentLoginDto {
  @IsString()
  @MinLength(2)
  studentCode!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
