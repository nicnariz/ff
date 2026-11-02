// Monta o estado da família no formato do motor de regras e grava de volta só o que mudou.
import { Prisma } from '@prisma/client';
import { emptyState } from './engine/engine';
import type { AppState, Member } from './engine/types';

/** Coleções do dia a dia guardadas em FamilyRecord (uma linha por registro). */
export const RECORD_KINDS = [
  'tasks',
  'assignments',
  'score',
  'wallet',
  'rewards',
  'redemptions',
  'piggyBanks',
  'allowanceConfigs',
  'allowancePeriods',
  'values',
  'goals',
  'notifications',
  'notificationPrefs',
  'timeline',
  'achievements',
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

type AnyRecord = { id?: string; memberId?: string } & Record<string, unknown>;

/** Chave de cada registro: o id, ou a pessoa nas coleções que são uma por pessoa. */
export function recordKey(kind: RecordKind, r: AnyRecord): string {
  if (kind === 'allowanceConfigs' || kind === 'notificationPrefs') return String(r.memberId);
  return String(r.id);
}

type Tx = Prisma.TransactionClient;

export type LoadedFamily = { state: AppState; me: Member; index: Map<string, string> };

/**
 * Lê a família inteira: pessoas e papéis (tabelas da conta) + registros do dia a dia.
 * Falha com FAMILY_ACCESS_DENIED se quem pede não participa ativamente da família.
 */
export async function loadFamily(tx: Tx, userId: string, familyId: string): Promise<LoadedFamily | null> {
  const family = await tx.family.findUnique({
    where: { id: familyId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, createdAt: true } } }, orderBy: { joinedAt: 'asc' } } },
  });
  if (!family) return null;
  const records = await tx.familyRecord.findMany({ where: { familyId }, select: { kind: true, data: true } });

  const d = emptyState();
  d.families = [{ id: family.id, name: family.name, timezone: 'America/Sao_Paulo', createdAt: family.createdAt.toISOString() }];
  family.members.forEach((m, i) => {
    if (!d.users.some((u) => u.id === m.user.id)) {
      d.users.push({ id: m.user.id, name: m.user.name, email: m.user.email, passwordHash: '', createdAt: m.user.createdAt.toISOString() });
    }
    d.members.push({
      id: m.id,
      familyId: family.id,
      userId: m.userId,
      displayName: m.user.name,
      nickname: m.nickname ?? undefined,
      role: m.role,
      status: m.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      canManage: m.role === 'ADMIN',
      canApprove: m.role === 'ADMIN' || m.canApproveTasks,
      tone: i % 5,
      joinedAt: m.joinedAt.toISOString(),
    });
  });
  const me = d.members.find((m) => m.userId === userId && m.status === 'ACTIVE');
  if (!me) return { state: d, me: undefined as unknown as Member, index: new Map() };

  const bag = d as unknown as Record<RecordKind, AnyRecord[]>;
  for (const r of records) {
    const kind = r.kind as RecordKind;
    if (!RECORD_KINDS.includes(kind)) continue;
    bag[kind].push(r.data as AnyRecord);
  }
  // Ordem estável (a ordem de inserção importa para listas como linha do tempo e notificações).
  for (const kind of RECORD_KINDS) {
    bag[kind].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || recordKey(kind, a).localeCompare(recordKey(kind, b)));
  }
  d.session = { userId, activeFamilyId: familyId, remote: true };
  return { state: d, me, index: indexOf(d) };
}

/** Assinatura de cada registro, para descobrir depois o que mudou. */
export function indexOf(d: AppState): Map<string, string> {
  const bag = d as unknown as Record<RecordKind, AnyRecord[]>;
  const index = new Map<string, string>();
  for (const kind of RECORD_KINDS) for (const r of bag[kind]) index.set(`${kind}\u0000${recordKey(kind, r)}`, JSON.stringify(r));
  return index;
}

/** Grava as inclusões/alterações e remove o que sumiu, em no máximo dois comandos. */
export async function saveChanges(tx: Tx, familyId: string, before: Map<string, string>, d: AppState): Promise<number> {
  const after = indexOf(d);
  const upserts: { k: string; r: string; d: unknown }[] = [];
  for (const [key, json] of after) {
    if (before.get(key) === json) continue;
    const [k, r] = key.split('\u0000');
    upserts.push({ k, r, d: JSON.parse(json) });
  }
  const removed = [...before.keys()].filter((k) => !after.has(k)).map((key) => key.split('\u0000'));
  if (upserts.length) {
    await tx.$executeRaw`
      INSERT INTO "FamilyRecord" ("familyId", "kind", "recordId", "data", "updatedAt")
      SELECT ${familyId}, x->>'k', x->>'r', x->'d', now()
      FROM jsonb_array_elements(${JSON.stringify(upserts)}::jsonb) AS x
      ON CONFLICT ("familyId", "kind", "recordId") DO UPDATE SET "data" = EXCLUDED."data", "updatedAt" = now()`;
  }
  if (removed.length) {
    await tx.$executeRaw`
      DELETE FROM "FamilyRecord" AS f
      USING jsonb_array_elements(${JSON.stringify(removed.map(([k, r]) => ({ k, r })))}::jsonb) AS x
      WHERE f."familyId" = ${familyId} AND f."kind" = x->>'k' AND f."recordId" = x->>'r'`;
  }
  return upserts.length + removed.length;
}

/**
 * O que cada pessoa recebe do estado da família:
 * notificações e preferências só as próprias; mesada completa só para a administração.
 */
export function viewFor(d: AppState, me: Member) {
  const mine = <T extends { memberId?: string }>(list: T[]) => list.filter((x) => x.memberId === me.id);
  return {
    familyId: d.families[0].id,
    family: d.families[0],
    users: d.users.map((u) => ({ id: u.id, name: u.name, email: u.id === me.userId ? u.email : '', passwordHash: '', createdAt: u.createdAt })),
    members: d.members,
    me: me.id,
    tasks: d.tasks,
    assignments: d.assignments,
    score: d.score,
    wallet: d.wallet,
    rewards: d.rewards,
    redemptions: d.redemptions,
    piggyBanks: d.piggyBanks,
    allowanceConfigs: me.canManage ? d.allowanceConfigs : mine(d.allowanceConfigs),
    allowancePeriods: me.canManage ? d.allowancePeriods : mine(d.allowancePeriods),
    values: d.values,
    goals: d.goals,
    notifications: mine(d.notifications),
    notificationPrefs: mine(d.notificationPrefs),
    timeline: d.timeline,
    achievements: d.achievements,
    serverTime: new Date().toISOString(),
  };
}
export type FamilyView = ReturnType<typeof viewFor>;
