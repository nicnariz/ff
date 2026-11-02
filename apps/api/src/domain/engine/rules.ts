// Cópia do motor de regras do app (src/data/rules.ts). Não edite aqui: altere no app e copie de novo.
// Regras de negócio puras (sem estado global). Testáveis isoladamente.
import type {
  AllowanceConfig,
  AllowancePeriod,
  AllowanceSnapshot,
  AllowanceStatus,
  AppState,
  Assignment,
  Member,
  NotificationPrefs,
  Task,
} from './types';
import { addDays, atTime, dayKey, diffDays, minutesOf, nowISO, parseDay } from './util';

// ---------------------------------------------------------------- Permissões

export const can = {
  manage: (m?: Member) => !!m && m.status === 'ACTIVE' && m.canManage,
  approve: (m?: Member) => !!m && m.status === 'ACTIVE' && m.canApprove,
};

export const roleLabel: Record<Member['role'], string> = {
  ADMIN: 'Administração',
  GUARDIAN: 'Responsável',
  MEMBER: 'Participante',
};

export function defaultPermissions(role: Member['role']) {
  return { canManage: role === 'ADMIN', canApprove: role !== 'MEMBER' };
}

// ---------------------------------------------------------------- Recorrência

export const HORIZON_DAYS = 30;
export const MAX_OCCURRENCES = 366;

/** Datas de ocorrência de uma tarefa entre `from` e `to` (inclusivo). */
export function occurrenceDates(task: Task, from: string, to: string): string[] {
  const start = task.startDate > from ? task.startDate : from;
  const end = task.endDate && task.endDate < to ? task.endDate : to;
  if (diffDays(start, end) < 0) return [];
  if (task.recurrence === 'NONE') {
    return task.startDate >= from && task.startDate <= to ? [task.startDate] : [];
  }
  const out: string[] = [];
  let cur = start;
  while (cur <= end && out.length < MAX_OCCURRENCES) {
    const wd = parseDay(cur).getDay();
    if (task.recurrence === 'DAILY' || task.weekdays.includes(wd)) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function buildAssignment(task: Task, memberId: string, date: string, id: string): Assignment {
  return {
    id,
    familyId: task.familyId,
    taskId: task.id,
    memberId,
    date,
    dueAt: atTime(date, task.dueTime).toISOString(),
    status: 'PENDING',
    expectedPoints: task.points,
  };
}

export const OPEN_STATUSES: Assignment['status'][] = ['PENDING', 'IN_PROGRESS', 'REJECTED'];
export const DONE_STATUSES: Assignment['status'][] = ['APPROVED', 'COMPLETED'];

/** Passou do horário combinado e ainda está aberta. É informação, não punição. */
export function isPastDue(a: Assignment, now = new Date()): boolean {
  return OPEN_STATUSES.includes(a.status) && new Date(a.dueAt).getTime() < now.getTime();
}

export type AssignmentView = 'todo' | 'doing' | 'review' | 'adjust' | 'done' | 'canceled';

export function assignmentView(a: Assignment): AssignmentView {
  switch (a.status) {
    case 'PENDING':
      return 'todo';
    case 'IN_PROGRESS':
      return 'doing';
    case 'WAITING_APPROVAL':
      return 'review';
    case 'REJECTED':
      return 'adjust';
    case 'APPROVED':
    case 'COMPLETED':
      return 'done';
    default:
      return 'canceled';
  }
}

export const statusText: Record<AssignmentView, string> = {
  todo: 'Para fazer',
  doing: 'Em andamento',
  review: 'Aguardando revisão',
  adjust: 'Precisa de um ajuste',
  done: 'Concluída',
  canceled: 'Cancelada',
};

// ---------------------------------------------------------------- Pontos e carteira

export function scoreTotal(s: AppState, memberId: string, from?: string, to?: string): number {
  return s.score
    .filter((t) => t.memberId === memberId)
    .filter((t) => {
      if (!from && !to) return true;
      const k = dayKey(new Date(t.createdAt));
      return (!from || k >= from) && (!to || k <= to);
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

export function familyScore(s: AppState, familyId: string, from: string, to: string): number {
  return s.score
    .filter((t) => t.familyId === familyId)
    .filter((t) => {
      const k = dayKey(new Date(t.createdAt));
      return k >= from && k <= to;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

export function walletAvailable(s: AppState, memberId: string): number {
  return s.wallet.filter((t) => t.memberId === memberId).reduce((sum, t) => sum + t.amount, 0);
}

export function walletReserved(s: AppState, memberId: string): number {
  return s.redemptions
    .filter((r) => r.memberId === memberId && (r.status === 'RESERVED' || r.status === 'APPROVED'))
    .reduce((sum, r) => sum + r.points, 0);
}

export function piggySaved(s: AppState, memberId: string): number {
  return s.piggyBanks
    .filter((p) => p.memberId === memberId && p.status !== 'ARCHIVED')
    .reduce((sum, p) => sum + p.saved, 0);
}

// ---------------------------------------------------------------- Mesada

export function periodBounds(frequency: AllowanceConfig['frequency'], ref = dayKey()): { start: string; end: string } {
  const d = parseDay(ref);
  if (frequency === 'WEEKLY') {
    const offset = (d.getDay() + 6) % 7; // semana começa na segunda
    const start = addDays(ref, -offset);
    return { start, end: addDays(start, 6) };
  }
  const start = dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { start, end };
}

export function periodsOverlap(a: { start: string; end: string }, b: { start: string; end: string }) {
  return a.start <= b.end && b.start <= a.end;
}

export function allowanceProgress(s: AppState, memberId: string, start: string, end: string) {
  const items = s.assignments.filter(
    (a) => a.memberId === memberId && a.date >= start && a.date <= end && a.status !== 'CANCELED',
  );
  const expected = items.reduce((sum, a) => sum + a.expectedPoints, 0);
  const earned = items.filter((a) => DONE_STATUSES.includes(a.status)).reduce((sum, a) => sum + a.expectedPoints, 0);
  const percent = expected === 0 ? 0 : Math.round((earned / expected) * 1000) / 10;
  return { expected, earned, percent, count: items.length };
}

/** Cálculo com arredondamento monetário só no final (para baixo, em centavos). */
export function calculateAllowance(
  cfg: AllowanceConfig,
  progress: { expected: number; earned: number; percent: number },
  adjustments: number,
): AllowanceSnapshot {
  const ratio = progress.expected === 0 ? 0 : Math.min(1, progress.earned / progress.expected);
  let calculated: number;
  if (cfg.policy === 'FULL_IF_MINIMUM' && progress.percent >= cfg.minimumPercent) calculated = cfg.baseAmount;
  else calculated = cfg.baseAmount * ratio;

  const bonus =
    cfg.bonusAmount && cfg.bonusThresholdPercent !== undefined && progress.percent >= cfg.bonusThresholdPercent
      ? cfg.bonusAmount
      : 0;

  let total = calculated + bonus + adjustments;
  let capApplied = false;
  if (cfg.capAmount !== undefined && cfg.capAmount > 0 && total > cfg.capAmount) {
    total = cfg.capAmount;
    capApplied = true;
  }
  total = Math.max(0, Math.floor(total * 100 + 1e-6) / 100);

  return {
    earnedPoints: progress.earned,
    expectedPoints: progress.expected,
    percent: progress.percent,
    baseAmount: cfg.baseAmount,
    policy: cfg.policy,
    minimumPercent: cfg.minimumPercent,
    calculatedAmount: Math.floor(calculated * 100 + 1e-6) / 100,
    bonusAmount: bonus,
    adjustments,
    capApplied,
    finalAmount: total,
    calculatedAt: nowISO(),
  };
}

/** Máquina de estados documentada para a mesada. PAID e CANCELLED são terminais. */
export const allowanceTransitions: Record<AllowanceStatus, AllowanceStatus[]> = {
  OPEN: ['CALCULATED', 'CANCELLED'],
  CALCULATED: ['CLOSED', 'CANCELLED'],
  CLOSED: ['APPROVED', 'REOPENED'],
  APPROVED: ['PAYMENT_PENDING', 'REOPENED'],
  PAYMENT_PENDING: ['PAID'],
  REOPENED: ['CALCULATED'],
  PAID: [],
  CANCELLED: [],
};

export const allowanceStatusText: Record<AllowanceStatus, string> = {
  OPEN: 'Em andamento',
  CALCULATED: 'Calculada',
  CLOSED: 'Fechada',
  APPROVED: 'Aprovada',
  PAYMENT_PENDING: 'Aguardando pagamento',
  PAID: 'Paga',
  REOPENED: 'Reaberta',
  CANCELLED: 'Cancelada',
};

export function canTransition(p: AllowancePeriod, to: AllowanceStatus) {
  return allowanceTransitions[p.status].includes(to);
}

// ---------------------------------------------------------------- Sequência e conquistas

/** Dias seguidos com pelo menos uma conclusão. Dia sem tarefa programada não quebra a sequência. */
export function streakDays(s: AppState, memberId: string, today = dayKey()): number {
  const mine = s.assignments.filter((a) => a.memberId === memberId && a.status !== 'CANCELED');
  const doneDays = new Set(mine.filter((a) => DONE_STATUSES.includes(a.status) || a.status === 'WAITING_APPROVAL').map((a) => a.date));
  const scheduled = new Set(mine.map((a) => a.date));
  if (mine.length === 0) return 0;
  const earliest = mine.reduce((min, a) => (a.date < min ? a.date : min), mine[0].date);
  let streak = 0;
  let cur = today;
  // hoje ainda em aberto não quebra a sequência
  if (!doneDays.has(cur)) cur = addDays(cur, -1);
  while (cur >= earliest) {
    if (doneDays.has(cur)) streak++;
    else if (scheduled.has(cur)) break;
    cur = addDays(cur, -1);
  }
  return streak;
}

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
  test: (stats: MemberStats) => boolean;
}

export interface MemberStats {
  done: number;
  onTime: number;
  essential: number;
  streak: number;
  goalsCompleted: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'FIRST_TASK', title: 'Primeiro combinado', description: 'Concluiu a primeira tarefa.', icon: 'flag', test: (s) => s.done >= 1 },
  { code: 'TEN_TASKS', title: 'Dez combinados', description: 'Dez tarefas concluídas.', icon: 'layers', test: (s) => s.done >= 10 },
  { code: 'TEN_ON_TIME', title: 'No ritmo', description: 'Dez tarefas concluídas no horário combinado.', icon: 'clock', test: (s) => s.onTime >= 10 },
  { code: 'TEN_ESSENTIAL', title: 'Base firme', description: 'Dez tarefas essenciais concluídas.', icon: 'home', test: (s) => s.essential >= 10 },
  { code: 'SEVEN_DAY_STREAK', title: 'Sete dias seguidos', description: 'Uma semana de constância.', icon: 'sun', test: (s) => s.streak >= 7 },
  { code: 'FIRST_GOAL', title: 'Meta alcançada', description: 'Participou de uma meta concluída.', icon: 'target', test: (s) => s.goalsCompleted >= 1 },
];

export function memberStats(s: AppState, memberId: string): MemberStats {
  const mine = s.assignments.filter((a) => a.memberId === memberId && DONE_STATUSES.includes(a.status));
  const tasksById = new Map(s.tasks.map((t) => [t.id, t]));
  const member = s.members.find((m) => m.id === memberId);
  return {
    done: mine.length,
    onTime: mine.filter((a) => !a.completedLate).length,
    essential: mine.filter((a) => tasksById.get(a.taskId)?.essential).length,
    streak: streakDays(s, memberId),
    goalsCompleted: s.goals.filter(
      (g) =>
        g.status === 'COMPLETED' &&
        g.familyId === member?.familyId &&
        (g.scope === 'FAMILY' || g.memberId === memberId),
    ).length,
  };
}

export function goalProgress(s: AppState, goalId: string): { current: number; percent: number } {
  const g = s.goals.find((x) => x.id === goalId);
  if (!g) return { current: 0, percent: 0 };
  const current = s.score
    .filter((t) => t.familyId === g.familyId && t.type !== 'GOAL_COMPLETION_BONUS')
    .filter((t) => (g.scope === 'FAMILY' ? true : t.memberId === g.memberId))
    .filter((t) => {
      const k = dayKey(new Date(t.createdAt));
      return k >= g.startDate && k <= g.endDate;
    })
    .reduce((sum, t) => sum + t.amount, 0);
  return { current: Math.max(0, current), percent: Math.min(100, Math.round((Math.max(0, current) / g.targetPoints) * 100)) };
}

// ---------------------------------------------------------------- Notificações

export const defaultPrefs = (memberId: string): NotificationPrefs => ({
  memberId,
  categories: { TASKS: true, APPROVAL: true, REWARDS: true, ALLOWANCE: true, ACHIEVEMENTS: true, FAMILY: true },
  quietHoursEnabled: false,
  quietStart: '21:00',
  quietEnd: '07:00',
});

/** Se estiver dentro do silêncio, a entrega não crítica é adiada para o fim do período. */
export function deliveryTime(prefs: NotificationPrefs | undefined, critical: boolean, now = new Date()): Date {
  if (!prefs || !prefs.quietHoursEnabled || critical) return now;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = minutesOf(prefs.quietStart);
  const end = minutesOf(prefs.quietEnd);
  const inQuiet = start <= end ? cur >= start && cur < end : cur >= start || cur < end;
  if (!inQuiet) return now;
  const out = new Date(now);
  out.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (out.getTime() <= now.getTime()) out.setDate(out.getDate() + 1);
  return out;
}
