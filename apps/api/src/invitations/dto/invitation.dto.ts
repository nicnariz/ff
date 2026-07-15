import { FamilyMemberRole } from '@prisma/client'; import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
export class CreateInvitationDto { @IsOptional() @IsEnum(FamilyMemberRole) role: FamilyMemberRole = FamilyMemberRole.MEMBER; @IsOptional() @IsInt() @Min(1) @Max(168) expiresInHours = 72; @IsOptional() @IsInt() @Min(1) @Max(20) maximumUses = 1; }
