import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DomainService, parseClientIds } from './domain.service';
import {
  AdjustmentDto,
  AllowanceConfigDto,
  AmountDto,
  BonusDto,
  CommentDto,
  GoalDto,
  NoteDto,
  OpenPeriodDto,
  PaymentNoteDto,
  PiggyDto,
  PrefsDto,
  ReasonDto,
  RewardDto,
  TaskDto,
  ValueDto,
} from './dto/domain.dto';
import type { OpName } from './engine/engine';

type AuthRequest = Request & { user: JwtPayload };
const plain = <T extends object>(dto: T) => JSON.parse(JSON.stringify(dto)) as T;

/**
 * Dia a dia da família. Toda resposta de alteração traz { result, state }:
 * o resultado da operação e o estado oficial da família, que o app usa para sincronizar os aparelhos.
 */
@ApiTags('family-day-to-day')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-Ids', required: false, description: 'Ids criados no aparelho para esta operação (opcional).' })
@UseGuards(JwtAuthGuard)
@Controller('families/:familyId')
export class DomainController {
  constructor(private readonly domain: DomainService) {}

  private go(r: AuthRequest, familyId: string, op: OpName, args: unknown[]) {
    return this.domain.run(r.user.sub, familyId, op, args, parseClientIds(r.headers['x-client-ids']));
  }

  @Get('state')
  @ApiOperation({ summary: 'Estado completo da família para quem está logado' })
  state(@Req() r: AuthRequest, @Param('familyId') f: string) {
    return this.domain.state(r.user.sub, f);
  }

  // ----- Valores da família
  @Post('values') createValue(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: ValueDto) { return this.go(r, f, 'saveValue', [plain(b)]); }
  @Patch('values/:id') updateValue(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: ValueDto) { return this.go(r, f, 'saveValue', [plain(b), id]); }
  @Delete('values/:id') removeValue(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'removeValue', [id]); }

  // ----- Tarefas
  @Post('tasks') createTask(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: TaskDto) { return this.go(r, f, 'saveTask', [plain(b)]); }
  @Patch('tasks/:id') updateTask(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: TaskDto) { return this.go(r, f, 'saveTask', [plain(b), id]); }
  @Delete('tasks/:id') cancelTask(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'cancelTask', [id]); }

  @Post('assignments/:id/start') @HttpCode(200) start(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'startAssignment', [id]); }
  @Post('assignments/:id/complete') @HttpCode(200) complete(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: NoteDto) { return this.go(r, f, 'completeAssignment', [id, b.evidenceNote]); }
  @Post('assignments/:id/approve') @HttpCode(200) approve(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: CommentDto) { return this.go(r, f, 'approveAssignment', [id, b.comment]); }
  @Post('assignments/:id/reject') @HttpCode(200) reject(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: ReasonDto) { return this.go(r, f, 'rejectAssignment', [id, b.reason]); }

  // ----- Pontos
  @Post('score/bonus') bonus(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: BonusDto) { return this.go(r, f, 'manualBonus', [b.memberId, b.amount, b.reason]); }
  @Post('score/:id/reverse') @HttpCode(200) reverse(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: ReasonDto) { return this.go(r, f, 'reverseScore', [id, b.reason]); }

  // ----- Recompensas e pedidos
  @Post('rewards') createReward(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: RewardDto) { return this.go(r, f, 'saveReward', [{ ...plain(b), stock: b.stock ?? null }]); }
  @Patch('rewards/:id') updateReward(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: RewardDto) { return this.go(r, f, 'saveReward', [{ ...plain(b), stock: b.stock ?? null }, id]); }
  @Delete('rewards/:id') archiveReward(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'archiveReward', [id]); }
  @Post('rewards/:id/redeem') redeem(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'redeem', [id]); }
  @Post('redemptions/:id/cancel') @HttpCode(200) cancelRedemption(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'cancelRedemption', [id]); }
  @Post('redemptions/:id/approve') @HttpCode(200) approveRedemption(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'approveRedemption', [id]); }
  @Post('redemptions/:id/reject') @HttpCode(200) rejectRedemption(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: ReasonDto) { return this.go(r, f, 'rejectRedemption', [id, b.reason]); }
  @Post('redemptions/:id/fulfill') @HttpCode(200) fulfillRedemption(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'fulfillRedemption', [id]); }

  // ----- Cofrinhos
  @Post('piggy-banks') createPiggy(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: PiggyDto) { return this.go(r, f, 'createPiggy', [b.title, b.target]); }
  @Post('piggy-banks/:id/contribute') @HttpCode(200) contribute(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: AmountDto) { return this.go(r, f, 'contributePiggy', [id, b.amount]); }
  @Post('piggy-banks/:id/withdraw') @HttpCode(200) withdraw(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: AmountDto) { return this.go(r, f, 'withdrawPiggy', [id, b.amount]); }
  @Delete('piggy-banks/:id') archivePiggy(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'archivePiggy', [id]); }

  // ----- Mesada
  @Put('allowance/configs/:memberId') saveConfig(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('memberId') m: string, @Body() b: AllowanceConfigDto) { return this.go(r, f, 'saveAllowanceConfig', [m, plain(b)]); }
  @Post('allowance/periods') openPeriod(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: OpenPeriodDto) { return this.go(r, f, 'openPeriod', [b.memberId]); }
  @Post('allowance/periods/:id/calculate') @HttpCode(200) calculate(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'calculatePeriod', [id]); }
  @Post('allowance/periods/:id/close') @HttpCode(200) close(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'closePeriod', [id]); }
  @Post('allowance/periods/:id/adjustments') adjust(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: AdjustmentDto) { return this.go(r, f, 'addAllowanceAdjustment', [id, b.amount, b.reason]); }
  @Post('allowance/periods/:id/approve') @HttpCode(200) approvePeriod(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'approvePeriod', [id]); }
  @Post('allowance/periods/:id/request-payment') @HttpCode(200) requestPayment(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'requestPayment', [id]); }
  @Post('allowance/periods/:id/pay') @HttpCode(200) pay(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: PaymentNoteDto) { return this.go(r, f, 'registerPayment', [id, b.note]); }
  @Post('allowance/periods/:id/reopen') @HttpCode(200) reopen(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string, @Body() b: PaymentNoteDto) { return this.go(r, f, 'reopenPeriod', [id, b.note]); }
  @Post('allowance/periods/:id/cancel') @HttpCode(200) cancelPeriod(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'cancelPeriod', [id]); }

  // ----- Metas
  @Post('goals') createGoal(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: GoalDto) { return this.go(r, f, 'saveGoal', [plain(b)]); }
  @Delete('goals/:id') archiveGoal(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'archiveGoal', [id]); }

  // ----- Notificações
  @Post('notifications/read-all') @HttpCode(200) readAll(@Req() r: AuthRequest, @Param('familyId') f: string) { return this.go(r, f, 'markAllRead', []); }
  @Post('notifications/:id/read') @HttpCode(200) read(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'markRead', [id]); }
  @Delete('notifications/:id') dismiss(@Req() r: AuthRequest, @Param('familyId') f: string, @Param('id') id: string) { return this.go(r, f, 'dismissNotification', [id]); }
  @Put('notification-preferences') prefs(@Req() r: AuthRequest, @Param('familyId') f: string, @Body() b: PrefsDto) { return this.go(r, f, 'savePrefs', [plain(b)]); }
}
