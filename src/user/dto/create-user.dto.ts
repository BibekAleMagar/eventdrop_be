import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
