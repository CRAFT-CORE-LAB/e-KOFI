import { IsString, MinLength } from 'class-validator';

export class ParentSessionDto {
  @IsString()
  @MinLength(2)
  studentCode!: string;
}
