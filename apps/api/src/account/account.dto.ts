import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
export class DeleteAccountDto { @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) password!: string; }
export class DeleteByCredentialsDto { @ApiProperty() @IsEmail() email!: string; @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) password!: string; }
