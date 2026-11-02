// Cópia do motor de regras do app (src/data/engine.ts). Não edite aqui: altere no app e copie de novo.
// Motor de regras do Família Feliz: funções puras sobre um rascunho do estado (sem tela, sem armazenamento).
// O mesmo arquivo roda no app (resposta imediata e família de exemplo) e no servidor (fonte da verdade).
import {
  ACHIEVEMENTS,
  HORIZON_DAYS,
  OPEN_STATUSES,
  allowanceProgress,
  buildAssignment,
  calculateAllowance,
  can,
  canTransition,
  defaultPermissions,
  defaultPrefs,
  deliveryTime,
  goalProgress,
  memberStats,
  occurrenceDates,
  periodBounds,
  periodsOverlap,
  walletAvailable,
} from './rules';
import type {
  AllowanceConfig,
  AllowancePeriod,
  AllowanceStatus,
  AppNotification,
  AppState,
  Goal,
  Member,
  NotificationCategory,
  NotificationPrefs,
  Role,
  Task,
  TimelineKind,
  WalletType,
  ScoreType,
} from './types';
import {
  addDays,
  dayKey,
  firstName,
  isValidDay,
  isValidTime,
  localHash,
  normalizeEmail,
  nowISO,
  pts,
  randomCode,
  uid,
} from './util';

// ---------------------------------------------------------------- Erros amigáveis

export class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
export const fail = (code: string, message: string): never => {
  throw new AppError(code, message);
};

// ---------------------------------------------------------------- Estado vazio

export function emptyState(): AppState {
  return {
    version: 1,
    users: [],
    families: [],
    members: [],
    invitations: [],
    tasks: [],
    assignments: [],
    score: [],
    wallet: [],
    rewards: [],
    redemptions: [],
    piggyBanks: [],
    allowanceConfigs: [],
    allowancePeriods: [],
    values: [],
    goals: [],
    notifications: [],
    notificationPrefs: [],
    timeline: [],
    achievements: [],
    recovery: [],
    session: null,
  };
}

// ---------------------------------------------------------------- Seletores

export function currentUser(s: AppState) {
  return s.session ? s.users.find((u) => u.id === s.session!.userId) : undefined;
}

export function myMemberships(s: AppState) {
  if (!s.session) return [];
  return s.members.filter((m) => m.userId === s.session!.userId && m.status === 'ACTIVE');
}

export function currentMember(s: AppState): Member | undefined {
  if (!s.session?.activeFamilyId) return undefined;
  return s.members.find(
    (m) => m.userId === s.session!.userId && m.familyId === s.session!.activeFamilyId && m.status === 'ACTIVE',
  );
}

export function currentFamily(s: AppState) {
  return s.session?.activeFamilyId ? s.families.find((f) => f.id === s.session!.activeFamilyId) : undefined;
}

export function familyMembers(s: AppState, familyId?: string, includeInactive = false) {
  return s.members.filter((m) => m.familyId === familyId && (includeInactive || m.status === 'ACTIVE'));
}

export function memberName(s: AppState, memberId?: string) {
  const m = s.members.find((x) => x.id === memberId);
  if (!m) return 'Alguém da família';
  return m.nickname || firstName(m.displayName);
}

// ---------------------------------------------------------------- Internos com draft

export function requireMe(d: AppState): Member {
  const me = currentMember(d);
  if (!me) fail('FAMILY_ACCESS_DENIED', 'Entre em uma família para continuar.');
  return me!;
}

export function requireManage(d: AppState): Member {
  const me = requireMe(d);
  if (!can.manage(me)) fail('FAMILY_ACCESS_DENIED', 'Somente a administração da família pode fazer isso.');
  return me;
}

export function requireApprove(d: AppState): Member {
  const me = requireMe(d);
  if (!can.approve(me)) fail('FAMILY_ACCESS_DENIED', 'Somente responsáveis com permissão de aprovar podem fazer isso.');
  return me;
}

function memberOf(d: AppState, familyId: string, memberId: string): Member {
  const m = d.members.find((x) => x.id === memberId && x.familyId === familyId);
  if (!m) fail('FAMILY_MEMBER_NOT_FOUND', 'Pessoa não encontrada nesta família.');
  return m!;
}

function notify(
  d: AppState,
  input: {
    familyId: string;
    to: string[];
    eventId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    link?: string;
    critical?: boolean;
  },
) {
  for (const memberId of Array.from(new Set(input.to))) {
    const prefs = d.notificationPrefs.find((p) => p.memberId === memberId);
    if (prefs && !prefs.categories[input.category] && !input.critical) continue;
    const eventId = `${input.eventId}:${memberId}`;
    if (d.notifications.some((n) => n.eventId === eventId)) continue; // idempotência
    const created = new Date();
    d.notifications.push({
      id: uid('ntf'),
      familyId: input.familyId,
      memberId,
      eventId,
      category: input.category,
      priority: input.critical ? 'CRITICAL' : 'NORMAL',
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: created.toISOString(),
      deliverAt: deliveryTime(prefs, !!input.critical, created).toISOString(),
    });
  }
}

function approversOf(d: AppState, familyId: string, exceptMemberId?: string) {
  return d.members
    .filter((m) => m.familyId === familyId && m.status === 'ACTIVE' && m.canApprove && m.id !== exceptMemberId)
    .map((m) => m.id);
}

function timeline(d: AppState, familyId: string, kind: TimelineKind, text: string, memberId?: string) {
  d.timeline.push({ id: uid('tl'), familyId, kind, memberId, text, createdAt: nowISO() });
}

function wallet(d: AppState, familyId: string, memberId: string, amount: number, type: WalletType, sourceId: string) {
  d.wallet.push({ id: uid('wal'), familyId, memberId, amount, type, sourceId, createdAt: nowISO() });
}

/** Crédito idempotente: ledger histórico + crédito elegível na carteira. */
function credit(
  d: AppState,
  familyId: string,
  memberId: string,
  amount: number,
  type: ScoreType,
  eventId: string,
  reason?: string,
  createdBy?: string,
) {
  if (amount === 0) return;
  if (d.score.some((t) => t.eventId === eventId)) return;
  const id = uid('scr');
  d.score.push({ id, familyId, memberId, amount, type, eventId, reason, createdBy, createdAt: nowISO() });
  wallet(d, familyId, memberId, amount, 'ELIGIBLE_CREDIT', id);
  afterScoreChange(d, familyId, memberId);
}

function afterScoreChange(d: AppState, familyId: string, memberId: string) {
  // Metas
  for (const g of d.goals.filter((x) => x.familyId === familyId && x.status === 'ACTIVE')) {
    if (g.scope === 'INDIVIDUAL' && g.memberId !== memberId) continue;
    const today = dayKey();
    if (today < g.startDate || today > g.endDate) continue;
    const { current } = goalProgress(d, g.id);
    if (current >= g.targetPoints) {
      g.status = 'COMPLETED';
      g.completedAt = nowISO();
      const beneficiaries =
        g.scope === 'FAMILY'
          ? d.members.filter((m) => m.familyId === familyId && m.status === 'ACTIVE' && m.role === 'MEMBER').map((m) => m.id)
          : [g.memberId!];
      for (const b of beneficiaries) {
        if (g.bonusPoints > 0) {
          const id = uid('scr');
          d.score.push({
            id,
            familyId,
            memberId: b,
            amount: g.bonusPoints,
            type: 'GOAL_COMPLETION_BONUS',
            eventId: `goal:${g.id}:${b}`,
            reason: `Meta “${g.title}” alcançada`,
            createdAt: nowISO(),
          });
          wallet(d, familyId, b, g.bonusPoints, 'ELIGIBLE_CREDIT', id);
        }
      }
      timeline(d, familyId, 'GOAL_COMPLETED', `Meta “${g.title}” alcançada`, g.memberId);
      notify(d, {
        familyId,
        to: d.members.filter((m) => m.familyId === familyId && m.status === 'ACTIVE').map((m) => m.id),
        eventId: `goal-done:${g.id}`,
        category: 'ACHIEVEMENTS',
        title: 'Meta alcançada',
        body: `“${g.title}” foi alcançada. Um passo de cada vez, juntos.`,
        link: '/progress',
      });
    }
  }
  // Conquistas
  const stats = memberStats(d, memberId);
  for (const a of ACHIEVEMENTS) {
    if (d.achievements.some((x) => x.memberId === memberId && x.code === a.code)) continue;
    if (!a.test(stats)) continue;
    d.achievements.push({ id: uid('ach'), familyId, memberId, code: a.code, unlockedAt: nowISO() });
    timeline(d, familyId, 'ACHIEVEMENT', `${memberNameD(d, memberId)} conquistou “${a.title}”`, memberId);
    notify(d, {
      familyId,
      to: [memberId],
      eventId: `ach:${a.code}`,
      category: 'ACHIEVEMENTS',
      title: 'Nova conquista',
      body: `${a.title}: ${a.description}`,
      link: '/progress',
    });
  }
}

function memberNameD(d: AppState, memberId?: string) {
  return memberName(d, memberId);
}

export function generateAssignments(d: AppState, task: Task, from: string, to: string) {
  if (task.status !== 'ACTIVE') return;
  for (const date of occurrenceDates(task, from, to)) {
    for (const memberId of task.assigneeIds) {
      const exists = d.assignments.some((a) => a.taskId === task.id && a.memberId === memberId && a.date === date);
      if (!exists) d.assignments.push(buildAssignment(task, memberId, date, uid('asg')));
    }
  }
}

/** Mantém a janela de ocorrências futuras (30 dias) das tarefas recorrentes sem data final. Retorna se mudou algo. */
export function ensureHorizon(d: AppState): boolean {
  if (!d.tasks.length) return false;
  const today = dayKey();
  const to = addDays(today, HORIZON_DAYS);
  const before = d.assignments.length;
  for (const t of d.tasks) generateAssignments(d, t, today, to);
  return d.assignments.length !== before;
}

export function startSession(d: AppState, userId: string, demo = false) {
  const memberships = d.members.filter((m) => m.userId === userId && m.status === 'ACTIVE');
  d.session = { userId, activeFamilyId: memberships[0]?.familyId, demo };
}

// ---------------------------------------------------------------- Auxiliares de recompensa e mesada

function releaseRedemption(d: AppState, redId: string, status: 'REJECTED' | 'CANCELLED', byId: string, note?: string) {
  const red = d.redemptions.find((x) => x.id === redId);
  if (!red) fail('REDEMPTION_NOT_FOUND', 'Pedido não encontrado.');
  if (red!.status !== 'RESERVED' && red!.status !== 'APPROVED') fail('INVALID_REDEMPTION_TRANSITION', 'Esse pedido já foi concluído.');
  red!.status = status;
  red!.updatedAt = nowISO();
  red!.decidedBy = byId;
  red!.note = note;
  const r = d.rewards.find((x) => x.id === red!.rewardId);
  if (r && r.stock !== null) r.stock += 1;
  wallet(d, red!.familyId, red!.memberId, red!.points, 'REWARD_POINTS_RELEASED', red!.id);
  return red!;
}

function moveAllowance(d: AppState, p: AllowancePeriod, to: AllowanceStatus, by: string, note?: string) {
  if (!canTransition(p, to)) fail('INVALID_ALLOWANCE_TRANSITION', 'Essa etapa não está disponível agora.');
  p.status = to;
  p.history.push({ status: to, at: nowISO(), by, note });
}

function managedPeriod(d: AppState, id: string) {
  const me = requireManage(d);
  const p = d.allowancePeriods.find((x) => x.id === id && x.familyId === me.familyId);
  if (!p) fail('ALLOWANCE_PERIOD_NOT_FOUND', 'Período não encontrado.');
  return { me, p: p! };
}

// ---------------------------------------------------------------- Ações

// ---------------------------------------------------------------- Operações

export const ops = {
  register(d: AppState, name: string, email: string, password: string) {
    const n = name.trim();
    const e = normalizeEmail(email);
    if (n.length < 2) fail('VALIDATION', 'Conte como você gostaria de ser chamado (mínimo de 2 letras).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('VALIDATION', 'Confira o e-mail: parece faltar alguma parte.');
    if (password.length < 8) fail('VALIDATION', 'A senha precisa ter pelo menos 8 caracteres.');
    if (d.users.some((u) => u.email === e)) fail('EMAIL_IN_USE', 'Já existe uma conta com este e-mail. Que tal entrar?');
    const user = { id: uid('usr'), name: n, email: e, passwordHash: localHash(password), createdAt: nowISO() };
    d.users.push(user);
    startSession(d, user.id);
    return user;
  },

  login(d: AppState, email: string, password: string) {
    const e = normalizeEmail(email);
    const user = d.users.find((u) => u.email === e);
    if (!user || user.passwordHash !== localHash(password))
      fail('INVALID_CREDENTIALS', 'E-mail ou senha não conferem. Tente de novo com calma.');
    startSession(d, user!.id, d.members.some((m) => m.userId === user!.id && m.familyId === 'fam_demo'));
    return user!;
  },

  logout(d: AppState) {
    d.session = null;
  },

  requestRecovery(d: AppState, email: string): string | null {
    const e = normalizeEmail(email);
    const user = d.users.find((u) => u.email === e);
    // Resposta neutra para não revelar se o e-mail existe.
    if (!user) return null;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    d.recovery = d.recovery.filter((r) => r.email !== e); // invalida pedidos anteriores
    d.recovery.push({ email: e, codeHash: localHash(code), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() });
    return code;
  },

  resetPassword(d: AppState, email: string, code: string, newPassword: string) {
    const e = normalizeEmail(email);
    const req = d.recovery.find((r) => r.email === e && !r.usedAt);
    if (!req || req.codeHash !== localHash(code.trim())) fail('RECOVERY_INVALID', 'Código inválido. Confira os 6 números.');
    if (new Date(req!.expiresAt).getTime() < Date.now()) fail('RECOVERY_EXPIRED', 'Esse código expirou. Peça um novo, sem problema.');
    if (newPassword.length < 8) fail('VALIDATION', 'A nova senha precisa ter pelo menos 8 caracteres.');
    req!.usedAt = nowISO();
    const user = d.users.find((u) => u.email === e)!;
    user.passwordHash = localHash(newPassword);
    d.session = null; // invalida sessões
  },

  switchDemoMember(d: AppState, memberId: string) {
    if (!d.session?.demo) fail('DENIED', 'Disponível apenas na família de exemplo.');
    const m = d.members.find((x) => x.id === memberId)!;
    d.session = { userId: m.userId, activeFamilyId: m.familyId, demo: true };
  },

  setActiveFamily(d: AppState, familyId: string) {
    if (!d.session) return;
    const ok = d.members.some((m) => m.familyId === familyId && m.userId === d.session!.userId && m.status === 'ACTIVE');
    if (!ok) fail('FAMILY_ACCESS_DENIED', 'Você não participa desta família.');
    d.session.activeFamilyId = familyId;
  },

  setPendingInvite(d: AppState, code?: string) {
    d.pendingInviteCode = code?.trim() || undefined;
  },

  createFamily(d: AppState, name: string, displayName?: string) {
    if (!d.session) fail('UNAUTHENTICATED', 'Entre na sua conta primeiro.');
    const n = name.trim();
    if (n.length < 2) fail('VALIDATION', 'Dê um nome para a família (mínimo de 2 letras).');
    const user = d.users.find((u) => u.id === d.session!.userId)!;
    const family = { id: uid('fam'), name: n, timezone: 'America/Sao_Paulo', createdAt: nowISO() };
    d.families.push(family);
    const member: Member = {
      id: uid('mem'),
      familyId: family.id,
      userId: user.id,
      displayName: displayName?.trim() || user.name,
      role: 'ADMIN',
      status: 'ACTIVE',
      ...defaultPermissions('ADMIN'),
      tone: 0,
      joinedAt: nowISO(),
    };
    d.members.push(member);
    d.notificationPrefs.push(defaultPrefs(member.id));
    d.session!.activeFamilyId = family.id;
    timeline(d, family.id, 'FAMILY_CREATED', `${n} começou a se organizar aqui`, member.id);
    return family;
  },

  updateFamily(d: AppState, name: string) {
    requireManage(d);
    const f = currentFamily(d)!;
    if (name.trim().length < 2) fail('VALIDATION', 'O nome precisa ter pelo menos 2 letras.');
    f.name = name.trim();
  },

  updateMember(d: AppState, 
    memberId: string,
    patch: Partial<Pick<Member, 'role' | 'canApprove' | 'canManage' | 'nickname' | 'status'>>,
  ) {
    const me = requireManage(d);
    const target = memberOf(d, me.familyId, memberId);
    const changesPerms =
      patch.role !== undefined || patch.canApprove !== undefined || patch.canManage !== undefined || patch.status !== undefined;
    if (changesPerms && target.id === me.id) fail('CANNOT_EDIT_OWN_PERMISSIONS', 'Você não pode alterar as próprias permissões.');
    const admins = d.members.filter((m) => m.familyId === me.familyId && m.status === 'ACTIVE' && m.role === 'ADMIN');
    const removesAdmin =
      target.role === 'ADMIN' && ((patch.role && patch.role !== 'ADMIN') || patch.status === 'INACTIVE');
    if (removesAdmin && admins.length <= 1) fail('LAST_ADMIN_CANNOT_BE_REMOVED', 'A família precisa de pelo menos uma pessoa na administração.');
    if (patch.role && patch.role !== target.role) {
      Object.assign(target, defaultPermissions(patch.role));
      target.role = patch.role;
    }
    if (patch.canApprove !== undefined) target.canApprove = patch.canApprove;
    if (patch.canManage !== undefined) target.canManage = patch.canManage && target.role === 'ADMIN';
    if (patch.nickname !== undefined) target.nickname = patch.nickname.trim() || undefined;
    if (patch.status) target.status = patch.status;
  },

  createInvitation(d: AppState, role: Exclude<Role, 'ADMIN'>, maxUses: number, days: number) {
    const me = requireManage(d);
    if (maxUses < 1 || maxUses > 20) fail('VALIDATION', 'Escolha entre 1 e 20 usos.');
    let code = randomCode();
    while (d.invitations.some((i) => i.code === code)) code = randomCode();
    const inv = {
      id: uid('inv'),
      familyId: me.familyId,
      code,
      role,
      maxUses,
      uses: 0,
      expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
      createdBy: me.id,
      createdAt: nowISO(),
    };
    d.invitations.push(inv);
    return inv;
  },

  revokeInvitation(d: AppState, id: string) {
    const me = requireManage(d);
    const inv = d.invitations.find((i) => i.id === id && i.familyId === me.familyId);
    if (inv && !inv.revokedAt) inv.revokedAt = nowISO();
  },

  acceptInvitation(d: AppState, code: string, displayName?: string) {
    if (!d.session) fail('UNAUTHENTICATED', 'Entre na sua conta para aceitar o convite.');
    const c = code.trim().toUpperCase();
    const inv = d.invitations.find((i) => i.code === c);
    if (!inv || inv.revokedAt || inv.uses >= inv.maxUses || new Date(inv.expiresAt).getTime() < Date.now())
      fail('INVITATION_INVALID', 'Esse convite não está mais disponível. Peça um novo para a família.');
    const user = d.users.find((u) => u.id === d.session!.userId)!;
    const existing = d.members.find((m) => m.familyId === inv!.familyId && m.userId === user.id);
    if (existing?.status === 'ACTIVE') fail('FAMILY_MEMBER_ALREADY_EXISTS', 'Você já faz parte desta família.');
    let member: Member;
    if (existing) {
      existing.status = 'ACTIVE';
      existing.role = inv!.role;
      Object.assign(existing, defaultPermissions(inv!.role));
      member = existing;
    } else {
      const count = d.members.filter((m) => m.familyId === inv!.familyId).length;
      member = {
        id: uid('mem'),
        familyId: inv!.familyId,
        userId: user.id,
        displayName: displayName?.trim() || user.name,
        role: inv!.role,
        status: 'ACTIVE',
        ...defaultPermissions(inv!.role),
        tone: count % 5,
        joinedAt: nowISO(),
      };
      d.members.push(member);
      d.notificationPrefs.push(defaultPrefs(member.id));
    }
    inv!.uses += 1;
    d.session!.activeFamilyId = inv!.familyId;
    d.pendingInviteCode = undefined;
    timeline(d, inv!.familyId, 'MEMBER_JOINED', `${firstName(member.displayName)} chegou à família`, member.id);
    notify(d, {
      familyId: inv!.familyId,
      to: d.members.filter((m) => m.familyId === inv!.familyId && m.canManage && m.id !== member.id).map((m) => m.id),
      eventId: `joined:${member.id}:${inv!.id}`,
      category: 'FAMILY',
      title: 'Alguém chegou',
      body: `${firstName(member.displayName)} aceitou o convite e já faz parte da família.`,
      link: `/member/${member.id}`,
    });
    return member;
  },

  saveValue(d: AppState, input: { title: string; description?: string }, id?: string) {
    const me = requireManage(d);
    if (input.title.trim().length < 2) fail('VALIDATION', 'Dê um nome ao valor.');
    if (id) {
      const v = d.values.find((x) => x.id === id && x.familyId === me.familyId);
      if (v) Object.assign(v, { title: input.title.trim(), description: input.description?.trim() });
    } else {
      if (d.values.some((v) => v.familyId === me.familyId && v.title.toLowerCase() === input.title.trim().toLowerCase()))
        fail('FAMILY_VALUE_ALREADY_EXISTS', 'Esse valor já está na lista.');
      d.values.push({ id: uid('val'), familyId: me.familyId, title: input.title.trim(), description: input.description?.trim(), createdAt: nowISO() });
    }
  },

  removeValue(d: AppState, id: string) {
    const me = requireManage(d);
    d.values = d.values.filter((v) => !(v.id === id && v.familyId === me.familyId));
    d.tasks.forEach((t) => {
      if (t.valueId === id) t.valueId = undefined;
    });
  },

  saveTask(d: AppState, 
    input: Omit<Task, 'id' | 'familyId' | 'status' | 'createdBy' | 'createdAt'>,
    id?: string,
  ) {
    const me = requireApprove(d);
    if (input.title.trim().length < 2) fail('VALIDATION', 'Dê um nome curto para a tarefa.');
    if (!Number.isInteger(input.points) || input.points < 0 || input.points > 1000) fail('VALIDATION', 'Os pontos vão de 0 a 1000.');
    if (!isValidDay(input.startDate)) fail('INVALID_TASK_DATES', 'Confira a data de início (AAAA-MM-DD).');
    if (input.endDate && (!isValidDay(input.endDate) || input.endDate < input.startDate))
      fail('INVALID_TASK_DATES', 'A data final precisa ser depois do início.');
    if (!isValidTime(input.dueTime)) fail('VALIDATION', 'Confira o horário (HH:MM).');
    if (input.recurrence === 'WEEKLY' && input.weekdays.length === 0) fail('INVALID_RECURRENCE_RULE', 'Escolha pelo menos um dia da semana.');
    if (input.assigneeIds.length === 0) fail('INVALID_TASK_ASSIGNEE', 'Escolha quem vai fazer.');
    for (const a of input.assigneeIds) memberOf(d, me.familyId, a);

    const today = dayKey();
    if (id) {
      const t = d.tasks.find((x) => x.id === id && x.familyId === me.familyId);
      if (!t) fail('TASK_NOT_FOUND', 'Tarefa não encontrada.');
      Object.assign(t!, { ...input, title: input.title.trim(), description: input.description?.trim() });
      // Ocorrências futuras em aberto acompanham a edição; datas passadas preservam o histórico.
      d.assignments.forEach((a) => {
        if (a.taskId === t!.id && a.date >= today && OPEN_STATUSES.includes(a.status)) {
          if (!t!.assigneeIds.includes(a.memberId) || !occurrenceDates(t!, a.date, a.date).length) a.status = 'CANCELED';
          else {
            a.expectedPoints = t!.points;
            const [h, m] = t!.dueTime.split(':').map(Number);
            const due = new Date(a.dueAt);
            due.setHours(h, m, 0, 0);
            a.dueAt = due.toISOString();
          }
        }
      });
      generateAssignments(d, t!, today > t!.startDate ? today : t!.startDate, addDays(today, HORIZON_DAYS));
      return t!;
    }
    const task: Task = {
      ...input,
      title: input.title.trim(),
      description: input.description?.trim(),
      id: uid('tsk'),
      familyId: me.familyId,
      status: 'ACTIVE',
      createdBy: me.id,
      createdAt: nowISO(),
    };
    d.tasks.push(task);
    generateAssignments(d, task, task.startDate, addDays(today > task.startDate ? today : task.startDate, HORIZON_DAYS));
    notify(d, {
      familyId: me.familyId,
      to: task.assigneeIds.filter((x) => x !== me.id),
      eventId: `task-assigned:${task.id}`,
      category: 'TASKS',
      title: 'Novo combinado',
      body: `${memberNameD(d, me.id)} combinou com você: “${task.title}”.`,
      link: '/tasks',
    });
    return task;
  },

  cancelTask(d: AppState, id: string) {
    const me = requireApprove(d);
    const t = d.tasks.find((x) => x.id === id && x.familyId === me.familyId);
    if (!t) fail('TASK_NOT_FOUND', 'Tarefa não encontrada.');
    t!.status = 'CANCELED';
    d.assignments.forEach((a) => {
      if (a.taskId === id && (OPEN_STATUSES.includes(a.status) || a.status === 'WAITING_APPROVAL')) a.status = 'CANCELED';
    });
  },

  startAssignment(d: AppState, id: string) {
    const me = requireMe(d);
    const a = d.assignments.find((x) => x.id === id && x.familyId === me.familyId);
    if (!a) fail('ASSIGNMENT_NOT_FOUND', 'Não encontramos essa tarefa.');
    if (a!.memberId !== me.id) fail('ASSIGNMENT_ACCESS_DENIED', 'Só quem está com a tarefa pode iniciá-la.');
    if (a!.status !== 'PENDING' && a!.status !== 'REJECTED') fail('INVALID_ASSIGNMENT_STATUS', 'Essa tarefa já foi iniciada.');
    a!.status = 'IN_PROGRESS';
    a!.startedAt = nowISO();
  },

  completeAssignment(d: AppState, id: string, evidenceNote?: string) {
    const me = requireMe(d);
    const a = d.assignments.find((x) => x.id === id && x.familyId === me.familyId);
    if (!a) fail('ASSIGNMENT_NOT_FOUND', 'Não encontramos essa tarefa.');
    if (a!.memberId !== me.id) fail('ASSIGNMENT_ACCESS_DENIED', 'Só quem está com a tarefa pode concluí-la.');
    if (!OPEN_STATUSES.includes(a!.status)) fail('INVALID_ASSIGNMENT_STATUS', 'Essa tarefa não está aberta.');
    const task = d.tasks.find((t) => t.id === a!.taskId)!;
    if (task.requiresEvidence && !evidenceNote?.trim())
      fail('EVIDENCE_REQUIRED', 'Conte rapidinho como ficou (ou cole o link de uma foto).');
    const now = new Date();
    a!.completedAt = now.toISOString();
    a!.completedLate = now.getTime() > new Date(a!.dueAt).getTime();
    a!.evidenceNote = evidenceNote?.trim() || undefined;
    a!.reviewComment = undefined;
    if (task.requiresApproval) {
      a!.status = 'WAITING_APPROVAL';
      notify(d, {
        familyId: me.familyId,
        to: approversOf(d, me.familyId, me.id),
        eventId: `review:${a!.id}:${a!.completedAt}`,
        category: 'APPROVAL',
        title: 'Uma tarefa para revisar',
        body: `${memberNameD(d, me.id)} concluiu “${task.title}”.`,
        link: `/assignment/${a!.id}`,
      });
      return 'review' as const;
    }
    // DEC-0020 pendente: nenhum desconto por atraso é aplicado.
    a!.status = 'COMPLETED';
    credit(d, me.familyId, me.id, a!.expectedPoints, 'TASK_AUTO_COMPLETION', `asg:${a!.id}`, task.title);
    timeline(d, me.familyId, 'TASK_DONE', `${memberNameD(d, me.id)} concluiu “${task.title}”`, me.id);
    return 'done' as const;
  },

  approveAssignment(d: AppState, id: string, comment?: string) {
    const me = requireApprove(d);
    const a = d.assignments.find((x) => x.id === id && x.familyId === me.familyId);
    if (!a) fail('ASSIGNMENT_NOT_FOUND', 'Não encontramos essa tarefa.');
    if (a!.status !== 'WAITING_APPROVAL') fail('INVALID_ASSIGNMENT_STATUS', 'Essa tarefa não está aguardando revisão.');
    if (a!.memberId === me.id) fail('ASSIGNMENT_ACCESS_DENIED', 'Outra pessoa responsável precisa revisar a sua tarefa.');
    const task = d.tasks.find((t) => t.id === a!.taskId)!;
    a!.status = 'APPROVED';
    a!.reviewedBy = me.id;
    a!.reviewedAt = nowISO();
    a!.reviewComment = comment?.trim() || undefined;
    // DEC-0020 pendente: pontos integrais, sem penalidade por atraso.
    credit(d, me.familyId, a!.memberId, a!.expectedPoints, 'TASK_APPROVAL', `asg:${a!.id}`, task.title, me.id);
    timeline(d, me.familyId, 'TASK_DONE', `${memberNameD(d, a!.memberId)} concluiu “${task.title}”`, a!.memberId);
    notify(d, {
      familyId: me.familyId,
      to: [a!.memberId],
      eventId: `approved:${a!.id}`,
      category: 'TASKS',
      title: 'Tarefa reconhecida',
      body: `“${task.title}” foi aprovada${a!.expectedPoints ? ` · +${pts(a!.expectedPoints)}` : ''}.${comment?.trim() ? ` “${comment.trim()}”` : ''}`,
      link: `/assignment/${a!.id}`,
    });
  },

  rejectAssignment(d: AppState, id: string, reason: string) {
    const me = requireApprove(d);
    const a = d.assignments.find((x) => x.id === id && x.familyId === me.familyId);
    if (!a) fail('ASSIGNMENT_NOT_FOUND', 'Não encontramos essa tarefa.');
    if (a!.status !== 'WAITING_APPROVAL') fail('INVALID_ASSIGNMENT_STATUS', 'Essa tarefa não está aguardando revisão.');
    if (a!.memberId === me.id) fail('ASSIGNMENT_ACCESS_DENIED', 'Outra pessoa responsável precisa revisar a sua tarefa.');
    if (reason.trim().length < 3) fail('REJECTION_REASON_REQUIRED', 'Explique com carinho o que falta ajustar.');
    const task = d.tasks.find((t) => t.id === a!.taskId)!;
    a!.status = 'REJECTED';
    a!.reviewedBy = me.id;
    a!.reviewedAt = nowISO();
    a!.reviewComment = reason.trim();
    notify(d, {
      familyId: me.familyId,
      to: [a!.memberId],
      eventId: `rejected:${a!.id}:${a!.reviewedAt}`,
      category: 'TASKS',
      title: 'Vamos ajustar juntos',
      body: `“${task.title}”: ${reason.trim()}`,
      link: `/assignment/${a!.id}`,
    });
  },

  manualBonus(d: AppState, memberId: string, amount: number, reason: string) {
    const me = requireApprove(d);
    memberOf(d, me.familyId, memberId);
    if (memberId === me.id) fail('CANNOT_ADJUST_OWN_SCORE', 'Você não pode ajustar os próprios pontos.');
    if (!Number.isInteger(amount) || amount < 1 || amount > 500) fail('SCORE_ADJUSTMENT_LIMIT', 'Use um valor entre 1 e 500 pontos.');
    if (reason.trim().length < 3) fail('INVALID_SCORE_ADJUSTMENT', 'Conte o motivo do reconhecimento.');
    credit(d, me.familyId, memberId, amount, 'MANUAL_BONUS', `bonus:${uid()}`, reason.trim(), me.id);
    notify(d, {
      familyId: me.familyId,
      to: [memberId],
      eventId: `bonus:${uid()}`,
      category: 'TASKS',
      title: 'Um reconhecimento para você',
      body: `+${pts(amount)} · ${reason.trim()}`,
      link: '/wallet',
    });
  },

  reverseScore(d: AppState, txId: string, reason: string) {
    const me = requireManage(d);
    const tx = d.score.find((t) => t.id === txId && t.familyId === me.familyId);
    if (!tx) fail('SCORE_TRANSACTION_NOT_FOUND', 'Lançamento não encontrado.');
    if (tx!.type === 'REVERSAL') fail('INVALID_SCORE_ADJUSTMENT', 'Uma correção não pode ser revertida.');
    if (d.score.some((t) => t.reversesId === txId)) fail('SCORE_TRANSACTION_ALREADY_REVERSED', 'Esse lançamento já foi corrigido.');
    if (tx!.memberId === me.id) fail('CANNOT_ADJUST_OWN_SCORE', 'Você não pode corrigir os próprios pontos.');
    if (reason.trim().length < 3) fail('INVALID_SCORE_ADJUSTMENT', 'Conte o motivo da correção.');
    if (walletAvailable(d, tx!.memberId) < tx!.amount)
      fail('REWARD_WALLET_INSUFFICIENT_BALANCE', 'Os pontos já foram usados ou guardados. A correção deixaria o saldo negativo.');
    const id = uid('scr');
    d.score.push({
      id,
      familyId: tx!.familyId,
      memberId: tx!.memberId,
      amount: -tx!.amount,
      type: 'REVERSAL',
      eventId: `reversal:${txId}`,
      reversesId: txId,
      reason: reason.trim(),
      createdBy: me.id,
      createdAt: nowISO(),
    });
    wallet(d, tx!.familyId, tx!.memberId, -tx!.amount, 'REVERSAL', id);
  },

  saveReward(d: AppState, input: { title: string; description?: string; cost: number; stock: number | null }, id?: string) {
    const me = requireManage(d);
    if (input.title.trim().length < 2) fail('VALIDATION', 'Dê um nome à recompensa.');
    if (!Number.isInteger(input.cost) || input.cost < 1 || input.cost > 100000) fail('VALIDATION', 'O custo vai de 1 a 100.000 pontos.');
    if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) fail('REWARD_STOCK_REQUIRED', 'Confira a quantidade disponível.');
    if (id) {
      const r = d.rewards.find((x) => x.id === id && x.familyId === me.familyId);
      if (r) Object.assign(r, { ...input, title: input.title.trim(), description: input.description?.trim() });
    } else {
      d.rewards.push({
        id: uid('rwd'),
        familyId: me.familyId,
        title: input.title.trim(),
        description: input.description?.trim(),
        cost: input.cost,
        stock: input.stock,
        status: 'ACTIVE',
        createdAt: nowISO(),
      });
    }
  },

  archiveReward(d: AppState, id: string) {
    const me = requireManage(d);
    const r = d.rewards.find((x) => x.id === id && x.familyId === me.familyId);
    if (r) r.status = 'ARCHIVED';
  },

  redeem(d: AppState, rewardId: string) {
    const me = requireMe(d);
    const r = d.rewards.find((x) => x.id === rewardId && x.familyId === me.familyId);
    if (!r || r.status !== 'ACTIVE') fail('REWARD_ITEM_UNAVAILABLE', 'Essa recompensa não está disponível agora.');
    if (r!.stock !== null && r!.stock <= 0) fail('REWARD_OUT_OF_STOCK', 'Acabou por enquanto. Pode ser que volte em breve.');
    if (walletAvailable(d, me.id) < r!.cost)
      fail('REWARD_WALLET_INSUFFICIENT_BALANCE', 'Ainda faltam alguns pontos. Você pode guardar para ela num cofrinho.');
    const red = {
      id: uid('red'),
      familyId: me.familyId,
      rewardId: r!.id,
      memberId: me.id,
      points: r!.cost,
      status: 'RESERVED' as const,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    d.redemptions.push(red);
    if (r!.stock !== null) r!.stock -= 1;
    wallet(d, me.familyId, me.id, -r!.cost, 'REWARD_POINTS_RESERVED', red.id);
    notify(d, {
      familyId: me.familyId,
      to: approversOf(d, me.familyId, me.id),
      eventId: `redeem:${red.id}`,
      category: 'REWARDS',
      title: 'Pedido de recompensa',
      body: `${memberNameD(d, me.id)} escolheu “${r!.title}”.`,
      link: '/redemptions',
    });
  },

  cancelRedemption(d: AppState, id: string) {
    const me = requireMe(d);
    const red = d.redemptions.find((x) => x.id === id && x.familyId === me.familyId);
    if (!red) fail('REDEMPTION_NOT_FOUND', 'Pedido não encontrado.');
    if (red!.memberId !== me.id && !can.approve(me)) fail('REWARD_ACCESS_DENIED', 'Só quem pediu pode cancelar.');
    releaseRedemption(d, id, 'CANCELLED', me.id);
  },

  approveRedemption(d: AppState, id: string) {
    const me = requireApprove(d);
    const red = d.redemptions.find((x) => x.id === id && x.familyId === me.familyId);
    if (!red) fail('REDEMPTION_NOT_FOUND', 'Pedido não encontrado.');
    if (red!.memberId === me.id) fail('REWARD_APPROVAL_DENIED', 'Outra pessoa responsável precisa aprovar o seu pedido.');
    if (red!.status !== 'RESERVED') fail('INVALID_REDEMPTION_TRANSITION', 'Esse pedido não está aguardando aprovação.');
    red!.status = 'APPROVED';
    red!.updatedAt = nowISO();
    red!.decidedBy = me.id;
    const r = d.rewards.find((x) => x.id === red!.rewardId);
    notify(d, {
      familyId: me.familyId,
      to: [red!.memberId],
      eventId: `red-approved:${red!.id}`,
      category: 'REWARDS',
      title: 'Pedido aprovado',
      body: `“${r?.title ?? 'Recompensa'}” foi aprovada. Agora é só combinar a entrega.`,
      link: '/wallet',
    });
  },

  rejectRedemption(d: AppState, id: string, reason: string) {
    const me = requireApprove(d);
    const red = d.redemptions.find((x) => x.id === id && x.familyId === me.familyId);
    if (!red) fail('REDEMPTION_NOT_FOUND', 'Pedido não encontrado.');
    if (red!.memberId === me.id) fail('REWARD_APPROVAL_DENIED', 'Outra pessoa responsável precisa decidir o seu pedido.');
    if (reason.trim().length < 3) fail('VALIDATION', 'Explique o motivo com carinho.');
    releaseRedemption(d, id, 'REJECTED', me.id, reason.trim());
    const r = d.rewards.find((x) => x.id === red!.rewardId);
    notify(d, {
      familyId: me.familyId,
      to: [red!.memberId],
      eventId: `red-rejected:${red!.id}`,
      category: 'REWARDS',
      title: 'Sobre o seu pedido',
      body: `“${r?.title ?? 'Recompensa'}” ficou para outro momento: ${reason.trim()}. Os pontos voltaram para a sua carteira.`,
      link: '/wallet',
    });
  },

  fulfillRedemption(d: AppState, id: string) {
    const me = requireApprove(d);
    const red = d.redemptions.find((x) => x.id === id && x.familyId === me.familyId);
    if (!red) fail('REDEMPTION_NOT_FOUND', 'Pedido não encontrado.');
    if (red!.status !== 'APPROVED') fail('INVALID_REDEMPTION_TRANSITION', 'Aprove o pedido antes de registrar a entrega.');
    red!.status = 'FULFILLED';
    red!.updatedAt = nowISO();
    const r = d.rewards.find((x) => x.id === red!.rewardId);
    timeline(d, me.familyId, 'REWARD_FULFILLED', `${memberNameD(d, red!.memberId)} recebeu “${r?.title ?? 'uma recompensa'}”`, red!.memberId);
    notify(d, {
      familyId: me.familyId,
      to: [red!.memberId],
      eventId: `red-fulfilled:${red!.id}`,
      category: 'REWARDS',
      title: 'Recompensa entregue',
      body: `Aproveite “${r?.title ?? 'sua recompensa'}”!`,
      link: '/wallet',
    });
  },

  createPiggy(d: AppState, title: string, target: number) {
    const me = requireMe(d);
    if (title.trim().length < 2) fail('VALIDATION', 'Dê um nome ao cofrinho.');
    if (!Number.isInteger(target) || target < 1) fail('VALIDATION', 'Escolha uma meta em pontos.');
    d.piggyBanks.push({ id: uid('pig'), familyId: me.familyId, memberId: me.id, title: title.trim(), target, saved: 0, status: 'ACTIVE', createdAt: nowISO() });
  },

  contributePiggy(d: AppState, id: string, amount: number) {
    const me = requireMe(d);
    const p = d.piggyBanks.find((x) => x.id === id && x.memberId === me.id);
    if (!p) fail('PIGGY_BANK_NOT_FOUND', 'Cofrinho não encontrado.');
    if (p!.status !== 'ACTIVE') fail('PIGGY_BANK_NOT_ACTIVE', 'Esse cofrinho já foi concluído.');
    if (!Number.isInteger(amount) || amount < 1) fail('VALIDATION', 'Escolha quantos pontos guardar.');
    if (walletAvailable(d, me.id) < amount) fail('REWARD_WALLET_INSUFFICIENT_BALANCE', 'Você não tem esse tanto de pontos disponíveis agora.');
    p!.saved += amount;
    wallet(d, me.familyId, me.id, -amount, 'PIGGY_BANK_CONTRIBUTION', p!.id);
    if (p!.saved >= p!.target) {
      p!.status = 'COMPLETED';
      timeline(d, me.familyId, 'PIGGY_COMPLETED', `${memberNameD(d, me.id)} completou o cofrinho “${p!.title}”`, me.id);
      notify(d, {
        familyId: me.familyId,
        to: [me.id],
        eventId: `piggy-done:${p!.id}`,
        category: 'REWARDS',
        title: 'Cofrinho completo',
        body: `Você juntou ${pts(p!.target)} em “${p!.title}”.`,
        link: '/wallet',
      });
    }
  },

  withdrawPiggy(d: AppState, id: string, amount: number) {
    const me = requireMe(d);
    const p = d.piggyBanks.find((x) => x.id === id && x.memberId === me.id);
    if (!p) fail('PIGGY_BANK_NOT_FOUND', 'Cofrinho não encontrado.');
    if (!Number.isInteger(amount) || amount < 1) fail('VALIDATION', 'Escolha quantos pontos retirar.');
    if (amount > p!.saved) fail('PIGGY_BANK_INSUFFICIENT_SAVED_POINTS', 'O cofrinho não tem tudo isso guardado.');
    p!.saved -= amount;
    if (p!.status === 'COMPLETED' && p!.saved < p!.target) p!.status = 'ACTIVE';
    wallet(d, me.familyId, me.id, amount, 'PIGGY_BANK_WITHDRAWAL', p!.id);
  },

  archivePiggy(d: AppState, id: string) {
    const me = requireMe(d);
    const p = d.piggyBanks.find((x) => x.id === id && x.memberId === me.id);
    if (!p) fail('PIGGY_BANK_NOT_FOUND', 'Cofrinho não encontrado.');
    if (p!.saved > 0) wallet(d, me.familyId, me.id, p!.saved, 'PIGGY_BANK_WITHDRAWAL', p!.id);
    p!.saved = 0;
    p!.status = 'ARCHIVED';
  },

  saveAllowanceConfig(d: AppState, memberId: string, input: Omit<AllowanceConfig, 'memberId' | 'familyId'>) {
    const me = requireManage(d);
    memberOf(d, me.familyId, memberId);
    if (!(input.baseAmount > 0) || input.baseAmount > 10000) fail('ALLOWANCE_AMOUNT_LIMIT', 'O valor base vai de R$ 0,01 a R$ 10.000,00.');
    if (input.minimumPercent < 0 || input.minimumPercent > 100) fail('VALIDATION', 'O percentual mínimo vai de 0 a 100.');
    const existing = d.allowanceConfigs.find((c) => c.memberId === memberId);
    if (existing) Object.assign(existing, input);
    else d.allowanceConfigs.push({ ...input, memberId, familyId: me.familyId });
  },

  openPeriod(d: AppState, memberId: string) {
    const me = requireManage(d);
    const cfg = d.allowanceConfigs.find((c) => c.memberId === memberId && c.familyId === me.familyId);
    if (!cfg || !cfg.active) fail('ALLOWANCE_CONFIGURATION_NOT_FOUND', 'Configure a mesada antes de abrir um período.');
    const bounds = periodBounds(cfg!.frequency);
    const clash = d.allowancePeriods.some(
      (p) => p.memberId === memberId && p.status !== 'CANCELLED' && periodsOverlap(p, bounds),
    );
    if (clash) fail('ALLOWANCE_PERIOD_OVERLAP', 'Já existe um período para essas datas.');
    const period: AllowancePeriod = {
      id: uid('alp'),
      familyId: me.familyId,
      memberId,
      ...bounds,
      status: 'OPEN',
      adjustments: [],
      history: [{ status: 'OPEN', at: nowISO(), by: me.id }],
    };
    d.allowancePeriods.push(period);
    return period;
  },

  calculatePeriod(d: AppState, id: string) {
    const { me, p } = managedPeriod(d, id);
    const cfg = d.allowanceConfigs.find((c) => c.memberId === p.memberId);
    if (!cfg) fail('ALLOWANCE_CONFIGURATION_NOT_FOUND', 'Configuração da mesada não encontrada.');
    const prog = allowanceProgress(d, p.memberId, p.start, p.end);
    const adj = p.adjustments.reduce((s, a) => s + a.amount, 0);
    moveAllowance(d, p, 'CALCULATED', me.id);
    p.snapshot = calculateAllowance(cfg!, prog, adj);
  },

  closePeriod(d: AppState, id: string) {
    const { me, p } = managedPeriod(d, id);
    moveAllowance(d, p, 'CLOSED', me.id);
  },

  addAllowanceAdjustment(d: AppState, id: string, amount: number, reason: string) {
    const { me, p } = managedPeriod(d, id);
    if (!['OPEN', 'CALCULATED', 'REOPENED'].includes(p.status)) fail('ALLOWANCE_ADJUSTMENT_STATE', 'Reabra o período para ajustar.');
    if (!(amount > 0)) fail('VALIDATION', 'Informe um valor positivo.');
    if (reason.trim().length < 3) fail('VALIDATION', 'Conte o motivo do ajuste.');
    p.adjustments.push({ id: uid('adj'), amount, reason: reason.trim(), createdBy: me.id, createdAt: nowISO() });
    if (p.status === 'CALCULATED' && p.snapshot) {
      const cfg = d.allowanceConfigs.find((c) => c.memberId === p.memberId)!;
      const prog = { expected: p.snapshot.expectedPoints, earned: p.snapshot.earnedPoints, percent: p.snapshot.percent };
      p.snapshot = calculateAllowance(cfg, prog, p.adjustments.reduce((s, a) => s + a.amount, 0));
    }
  },

  approvePeriod(d: AppState, id: string) {
    const { me, p } = managedPeriod(d, id);
    if (p.memberId === me.id) fail('CANNOT_APPROVE_OWN_ALLOWANCE', 'Outra pessoa da administração precisa aprovar a sua mesada.');
    moveAllowance(d, p, 'APPROVED', me.id);
    notify(d, {
      familyId: me.familyId,
      to: [p.memberId],
      eventId: `allow-approved:${p.id}:${p.history.length}`,
      category: 'ALLOWANCE',
      title: 'Mesada aprovada',
      body: `O período de ${p.start.split('-').reverse().slice(0, 2).join('/')} a ${p.end.split('-').reverse().slice(0, 2).join('/')} foi aprovado.`,
      link: '/wallet',
    });
  },

  requestPayment(d: AppState, id: string) {
    const { me, p } = managedPeriod(d, id);
    moveAllowance(d, p, 'PAYMENT_PENDING', me.id);
  },

  registerPayment(d: AppState, id: string, note: string) {
    const { me, p } = managedPeriod(d, id);
    moveAllowance(d, p, 'PAID', me.id, note.trim() || undefined);
    p.paidNote = note.trim() || undefined;
    notify(d, {
      familyId: me.familyId,
      to: [p.memberId],
      eventId: `allow-paid:${p.id}`,
      category: 'ALLOWANCE',
      title: 'Mesada registrada como paga',
      body: p.snapshot ? `Valor combinado: R$ ${p.snapshot.finalAmount.toFixed(2).replace('.', ',')}.` : 'Pagamento registrado.',
      link: '/wallet',
    });
  },

  reopenPeriod(d: AppState, id: string, note: string) {
    const { me, p } = managedPeriod(d, id);
    if (note.trim().length < 3) fail('VALIDATION', 'Conte o motivo da reabertura.');
    moveAllowance(d, p, 'REOPENED', me.id, note.trim());
  },

  cancelPeriod(d: AppState, id: string) {
    const { me, p } = managedPeriod(d, id);
    moveAllowance(d, p, 'CANCELLED', me.id);
  },

  saveGoal(d: AppState, input: Omit<Goal, 'id' | 'familyId' | 'status' | 'createdAt' | 'completedAt'>) {
    const me = requireManage(d);
    if (input.title.trim().length < 2) fail('INVALID_GROWTH_GOAL', 'Dê um nome à meta.');
    if (!Number.isInteger(input.targetPoints) || input.targetPoints < 1) fail('INVALID_GROWTH_GOAL', 'Escolha um alvo em pontos.');
    if (!isValidDay(input.startDate) || !isValidDay(input.endDate) || input.endDate < input.startDate)
      fail('INVALID_GROWTH_PERIOD', 'Confira as datas da meta.');
    if (input.scope === 'INDIVIDUAL') memberOf(d, me.familyId, input.memberId ?? '');
    d.goals.push({ ...input, title: input.title.trim(), id: uid('gol'), familyId: me.familyId, status: 'ACTIVE', createdAt: nowISO() });
  },

  archiveGoal(d: AppState, id: string) {
    const me = requireManage(d);
    const g = d.goals.find((x) => x.id === id && x.familyId === me.familyId);
    if (g && g.status === 'ACTIVE') g.status = 'ARCHIVED';
  },

  markRead(d: AppState, id: string) {
    const me = requireMe(d);
    const n = d.notifications.find((x) => x.id === id && x.memberId === me.id);
    if (n && !n.readAt) n.readAt = nowISO();
  },

  markAllRead(d: AppState) {
    const me = requireMe(d);
    const now = Date.now();
    d.notifications.forEach((n) => {
      if (n.memberId === me.id && !n.readAt && new Date(n.deliverAt).getTime() <= now) n.readAt = nowISO();
    });
  },

  dismissNotification(d: AppState, id: string) {
    const me = requireMe(d);
    const n = d.notifications.find((x) => x.id === id && x.memberId === me.id);
    if (n) n.dismissedAt = nowISO(); // exclusão lógica
  },

  savePrefs(d: AppState, prefs: Omit<NotificationPrefs, 'memberId'>) {
    const me = requireMe(d);
    if (!isValidTime(prefs.quietStart) || !isValidTime(prefs.quietEnd)) fail('VALIDATION', 'Confira os horários (HH:MM).');
    d.notificationPrefs = d.notificationPrefs.filter((p) => p.memberId !== me.id);
    d.notificationPrefs.push({ ...prefs, memberId: me.id });
  },
};

export type OpName = keyof typeof ops;

// ---------------------------------------------------------------- Seletores de notificação

export function visibleNotifications(s: AppState, memberId?: string): AppNotification[] {
  const now = Date.now();
  return s.notifications
    .filter((n) => n.memberId === memberId && !n.dismissedAt && new Date(n.deliverAt).getTime() <= now)
    .sort((a, b) => b.deliverAt.localeCompare(a.deliverAt));
}

export function unreadCount(s: AppState, memberId?: string) {
  return visibleNotifications(s, memberId).filter((n) => !n.readAt).length;
}

export function prefsOf(s: AppState, memberId: string): NotificationPrefs {
  return s.notificationPrefs.find((p) => p.memberId === memberId) ?? defaultPrefs(memberId);
}

export function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  return 'Algo não saiu como esperado. Tente de novo em instantes.';
}
