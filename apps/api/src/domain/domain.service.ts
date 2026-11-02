import { ForbiddenException, HttpException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AppError, ensureHorizon, ops, type OpName } from './engine/engine';
import { ID_PATTERN, withIds } from './engine/util';
import { loadFamily, saveChanges, viewFor, type FamilyView } from './family-state';

/** Operações que as rotas podem executar (as de conta, família e convite ficam nos módulos próprios). */
export const DOMAIN_OPS = new Set<OpName>([
  'saveValue', 'removeValue',
  'saveTask', 'cancelTask', 'startAssignment', 'completeAssignment', 'approveAssignment', 'rejectAssignment',
  'manualBonus', 'reverseScore',
  'saveReward', 'archiveReward', 'redeem', 'cancelRedemption', 'approveRedemption', 'rejectRedemption', 'fulfillRedemption',
  'createPiggy', 'contributePiggy', 'withdrawPiggy', 'archivePiggy',
  'saveAllowanceConfig', 'openPeriod', 'calculatePeriod', 'closePeriod', 'addAllowanceAdjustment', 'approvePeriod',
  'requestPayment', 'registerPayment', 'reopenPeriod', 'cancelPeriod',
  'saveGoal', 'archiveGoal',
  'markRead', 'markAllRead', 'dismissNotification', 'savePrefs',
]);

export interface OpResult {
  result: unknown;
  state: FamilyView;
}

/** Lê ids sugeridos pelo aparelho (cabeçalho X-Client-Ids), aceitando só o formato do motor. */
export function parseClientIds(header: string | string[] | undefined): string[] {
  const raw = Array.isArray(header) ? header.join(',') : header ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ID_PATTERN.test(s))
    .slice(0, 50);
}

@Injectable()
export class DomainService {
  constructor(private readonly prisma: PrismaService) {}

  /** Estado da família para quem pede (também completa as ocorrências futuras das tarefas). */
  state(userId: string, familyId: string): Promise<FamilyView> {
    return this.inFamily(userId, familyId, null, [], []).then((r) => r.state);
  }

  async run(userId: string, familyId: string, op: OpName, args: unknown[], clientIds: string[] = []): Promise<OpResult> {
    if (!DOMAIN_OPS.has(op)) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.inFamily(userId, familyId, op, args, clientIds);
  }

  /**
   * Uma operação por vez em cada família (trava da transação): lê, aplica a regra, grava o que mudou.
   * Assim dois aparelhos aprovando a mesma tarefa ao mesmo tempo não creditam pontos duas vezes.
   */
  private async inFamily(userId: string, familyId: string, op: OpName | null, args: unknown[], clientIds: string[]): Promise<OpResult> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${familyId}))`;
        const loaded = await loadFamily(tx, userId, familyId);
        if (!loaded) throw new NotFoundException({ code: 'FAMILY_NOT_FOUND' });
        if (!loaded.me) throw new ForbiddenException({ code: 'FAMILY_ACCESS_DENIED' });
        const { state: d, me, index } = loaded;
        ensureHorizon(d);
        let result: unknown = null;
        if (op) {
          // Ids já usados na família não são aceitos de novo.
          const taken = new Set([...index.keys()].map((k) => k.split('\u0000')[1]));
          const ids = clientIds.filter((id) => !taken.has(id));
          try {
            result = withIds(ids, () => (ops[op] as unknown as (...a: unknown[]) => unknown)(d, ...args));
          } catch (e) {
            throw toHttp(e);
          }
          ensureHorizon(d);
        }
        await saveChanges(tx, familyId, index, d);
        return { result: result === undefined ? null : result, state: viewFor(d, me) };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  }
}

function toHttp(e: unknown): HttpException {
  if (e instanceof AppError) {
    if (e.code === 'FAMILY_ACCESS_DENIED' || e.code.endsWith('ACCESS_DENIED')) return new ForbiddenException({ code: e.code, message: e.message });
    if (e.code.endsWith('NOT_FOUND')) return new NotFoundException({ code: e.code, message: e.message });
    return new UnprocessableEntityException({ code: e.code, message: e.message });
  }
  if (e instanceof HttpException) return e;
  if (e instanceof TypeError) return new UnprocessableEntityException({ code: 'VALIDATION', message: 'Algum dado não está no formato esperado. Confira e tente de novo.' });
  throw e;
}
