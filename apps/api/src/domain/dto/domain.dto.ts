// Formatos aceitos pelas rotas do dia a dia. As regras de negócio (limites, permissões, estados)
// ficam no motor de regras; aqui só garantimos os tipos e tamanhos.
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export class ValueDto {
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class TaskDto {
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(0) @Max(1000) points!: number;
  @IsIn(['NONE', 'DAILY', 'WEEKLY']) recurrence!: 'NONE' | 'DAILY' | 'WEEKLY';
  @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays!: number[];
  @Matches(DAY) startDate!: string;
  @IsOptional() @Matches(DAY) endDate?: string;
  @Matches(TIME) dueTime!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) assigneeIds!: string[];
  @IsBoolean() requiresApproval!: boolean;
  @IsBoolean() requiresEvidence!: boolean;
  @IsBoolean() essential!: boolean;
  @IsOptional() @IsString() valueId?: string;
}

export class NoteDto {
  @IsOptional() @IsString() @MaxLength(500) evidenceNote?: string;
}
export class CommentDto {
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}
export class ReasonDto {
  @IsString() @MaxLength(500) reason!: string;
}
export class PaymentNoteDto {
  @IsString() @MaxLength(500) note!: string;
}

export class BonusDto {
  @IsString() memberId!: string;
  @IsInt() @Min(-1000) @Max(1000) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class RewardDto {
  @IsString() @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() cost!: number;
  @IsOptional() @IsInt() stock?: number | null;
}

export class PiggyDto {
  @IsString() @MaxLength(80) title!: string;
  @IsInt() @Min(1) @Max(1_000_000) target!: number;
}
export class AmountDto {
  @IsInt() @Min(1) @Max(1_000_000) amount!: number;
}

export class AllowanceConfigDto {
  @IsNumber({ maxDecimalPlaces: 2 }) baseAmount!: number;
  @IsIn(['WEEKLY', 'MONTHLY']) frequency!: 'WEEKLY' | 'MONTHLY';
  @IsIn(['PROPORTIONAL', 'FULL_IF_MINIMUM']) policy!: 'PROPORTIONAL' | 'FULL_IF_MINIMUM';
  @IsInt() minimumPercent!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) capAmount?: number;
  @IsOptional() @IsInt() bonusThresholdPercent?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) bonusAmount?: number;
  @IsBoolean() active!: boolean;
}
export class OpenPeriodDto {
  @IsString() memberId!: string;
}
export class AdjustmentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(-10000) @Max(10000) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class GoalDto {
  @IsString() @MaxLength(80) title!: string;
  @IsIn(['FAMILY', 'INDIVIDUAL']) scope!: 'FAMILY' | 'INDIVIDUAL';
  @IsOptional() @IsString() memberId?: string;
  @IsInt() targetPoints!: number;
  @Matches(DAY) startDate!: string;
  @Matches(DAY) endDate!: string;
  @IsInt() @Min(0) @Max(10000) bonusPoints!: number;
}

export class CategoriesDto {
  @IsBoolean() TASKS!: boolean;
  @IsBoolean() APPROVAL!: boolean;
  @IsBoolean() REWARDS!: boolean;
  @IsBoolean() ALLOWANCE!: boolean;
  @IsBoolean() ACHIEVEMENTS!: boolean;
  @IsBoolean() FAMILY!: boolean;
}
export class PrefsDto {
  @ValidateNested() @Type(() => CategoriesDto) categories!: CategoriesDto;
  @IsBoolean() quietHoursEnabled!: boolean;
  @Matches(TIME) quietStart!: string;
  @Matches(TIME) quietEnd!: string;
}
