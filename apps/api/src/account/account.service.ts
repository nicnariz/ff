import { ForbiddenException, HttpException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';

/** Registros do dia a dia que são da própria pessoa e somem com a conta. */
const PERSONAL_KINDS = ['notifications', 'notificationPrefs', 'timeline', 'allowanceConfigs'];

export interface DeletionResult {
  deleted: true;
  /** Famílias em que a pessoa era a única participante e que foram encerradas. */
  closedFamilies: number;
  /** Famílias em que outra pessoa responsável passou a administrar. */
  transferredFamilies: { familyId: string; newAdminMemberId: string }[];
}

/**
 * Exclusão de conta (Google Play e LGPD):
 * - confirma a senha;
 * - em cada família: se a pessoa era a única participante, a família é encerrada e todos os registros apagados;
 *   se era a única administradora, a pessoa responsável mais antiga assume; sem responsável, a exclusão é recusada
 *   com uma orientação (para não deixar crianças numa família sem adulto);
 * - apaga notificações, preferências, linha do tempo e configuração de mesada da pessoa;
 * - remove nome, e-mail, senha e dados de perfil (o registro fica anônimo só para manter a consistência do histórico da família).
 */
@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async deleteById(userId: string, password: string): Promise<DeletionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    // 403 (e não 401): a sessão é válida, só a senha de confirmação está errada.
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new ForbiddenException({ code: 'INVALID_PASSWORD', message: 'Senha incorreta. Confira e tente de novo.' });
    return this.erase(user.id);
  }

  async deleteByCredentials(email: string, password: string): Promise<DeletionResult> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const ok = !!user && user.status === 'ACTIVE' && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    return this.erase(user!.id);
  }

  private async erase(userId: string): Promise<DeletionResult> {
    const filler = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    return this.prisma.$transaction(
      async (tx) => {
        const memberships = await tx.familyMember.findMany({
          where: { userId, status: 'ACTIVE' },
          include: { family: { include: { members: { where: { status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' } } } } },
        });

        // 1) Primeiro confere tudo (nada muda se alguma família ficaria sem adulto).
        const plan = memberships.map((m) => {
          const others = m.family.members.filter((x) => x.userId !== userId);
          const otherAdmin = others.some((x) => x.role === 'ADMIN');
          const successor = m.role === 'ADMIN' && !otherAdmin ? others.find((x) => x.role === 'GUARDIAN') : undefined;
          if (others.length && m.role === 'ADMIN' && !otherAdmin && !successor) {
            throw new UnprocessableEntityException({
              code: 'LAST_ADMIN_NO_SUCCESSOR',
              message: `Em "${m.family.name}", você é a única pessoa adulta na administração. Promova alguém a administrador ou responsável (em Família → pessoa) ou remova os demais participantes antes de excluir a conta.`,
            });
          }
          return { m, others, successor };
        });

        // 2) Aplica.
        const result: DeletionResult = { deleted: true, closedFamilies: 0, transferredFamilies: [] };
        for (const { m, others, successor } of plan) {
          if (!others.length) {
            await tx.familyRecord.deleteMany({ where: { familyId: m.familyId } });
            await tx.familyInvitation.updateMany({ where: { familyId: m.familyId, status: 'ACTIVE' }, data: { status: 'REVOKED' } });
            await tx.family.update({ where: { id: m.familyId }, data: { status: 'ARCHIVED', name: 'Família encerrada', avatarUrl: null } });
            result.closedFamilies++;
          } else {
            if (successor) {
              await tx.familyMember.update({ where: { id: successor.id }, data: { role: 'ADMIN', canCreateTasks: true, canApproveTasks: true } });
              result.transferredFamilies.push({ familyId: m.familyId, newAdminMemberId: successor.id });
            }
            await tx.$executeRaw`
              DELETE FROM "FamilyRecord"
              WHERE "familyId" = ${m.familyId} AND "kind" = ANY(${PERSONAL_KINDS}::text[]) AND "data"->>'memberId' = ${m.id}`;
          }
          await tx.familyMember.update({ where: { id: m.id }, data: { status: 'REMOVED', nickname: null, canCreateTasks: false, canApproveTasks: false } });
        }
        await tx.familyMember.updateMany({ where: { userId, status: { not: 'REMOVED' } }, data: { status: 'REMOVED', nickname: null } });

        await tx.notification.deleteMany({ where: { userId } });
        await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
        await tx.user.update({
          where: { id: userId },
          data: {
            name: 'Conta excluída',
            email: `excluida-${userId}@excluida.invalid`,
            passwordHash: filler,
            refreshTokenHash: null,
            birthDate: null,
            avatarUrl: null,
            status: 'INACTIVE',
          },
        });
        return result;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
}

/** Limite simples de tentativas por endereço (página pública de exclusão). */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly max = 5, private readonly windowMs = 15 * 60_000) {}
  check(key: string) {
    const now = Date.now();
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) throw new HttpException({ code: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas. Espere 15 minutos e tente de novo.' }, 429);
    list.push(now);
    this.hits.set(key, list);
  }
}
