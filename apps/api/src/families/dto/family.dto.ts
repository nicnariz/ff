import { FamilyMemberRole, MemberStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateFamilyDto { @IsString() @MinLength(2) @MaxLength(80) name!: string; }
export class UpdateFamilyDto { @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string; @IsOptional() @IsUrl() avatarUrl?: string; }
export class UpdateMemberDto { @IsOptional() @IsString() @MaxLength(50) nickname?: string; @IsOptional() @IsEnum(FamilyMemberRole) role?: FamilyMemberRole; @IsOptional() @IsBoolean() canCreateTasks?: boolean; @IsOptional() @IsBoolean() canApproveTasks?: boolean; @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus; }
export class MembersQueryDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20; @IsOptional() @IsEnum(MemberStatus) status?: MemberStatus; @IsOptional() @IsEnum(FamilyMemberRole) role?: FamilyMemberRole; @IsOptional() @IsString() search?: string; }
