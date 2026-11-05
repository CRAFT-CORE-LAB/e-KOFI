import { IsString, MinLength } from 'class-validator';

export class StudentCodeDto {
  @IsString()
  @MinLength(2)
  studentCode!: string;
}
