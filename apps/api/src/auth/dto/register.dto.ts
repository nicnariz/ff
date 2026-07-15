import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Silva' }) @IsString() @MinLength(2) name!: string;
  @ApiProperty({ example: 'ana@example.com' }) @IsEmail() email!: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password!: string;
  @ApiProperty({ required: false, example: '2012-03-20' }) @IsOptional() @IsDateString() birthDate?: string;
}
