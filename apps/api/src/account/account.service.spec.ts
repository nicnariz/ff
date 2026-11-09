import * as bcrypt from 'bcrypt';
import { AccountService } from './account.service';

// "Banco" em memória com o necessário para a exclusão de conta.
async function fakeDb() {
  const hash = await bcrypt.hash('segredo123', 4);
  const user = (id: string, name: string) => ({ id, name, email: `${id}@x.com`, passwordHash: hash, refreshTokenHash: 'r', birthDate: null, avatarUrl: null, status: 'ACTIVE' });
  const db = {
    users: [user('u_ana', 'Ana'), user('u_beto', 'Beto'), user('u_caio', 'Caio'), user('u_solo', 'Solo')],
    families: [
      { id: 'f1', name: 'Família Oliveira', status: 'ACTIVE', avatarUrl: null },
      { id: 'f2', name: 'Família Solo', status: 'ACTIVE', avatarUrl: null },
      { id: 'f3', name: 'Família Só Criança', status: 'ACTIVE', avatarUrl: null },
    ],
    members: [
      { id: 'm_ana', familyId: 'f1', userId: 'u_ana', role: 'ADMIN', status: 'ACTIVE', joinedAt: new Date('2026-01-01'), nickname: 'Mãe', canCreateTasks: true, canApproveTasks: true },
      { id: 'm_beto', familyId: 'f1', userId: 'u_beto', role: 'GUARDIAN', status: 'ACTIVE', joinedAt: new Date('2026-01-02'), nickname: null, canCreateTasks: true, canApproveTasks: true },
      { id: 'm_caio', familyId: 'f1', userId: 'u_caio', role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date('2026-01-03'), nickname: null, canCreateTasks: false, canApproveTasks: false },
      { id: 'm_solo', familyId: 'f2', userId: 'u_solo', role: 'ADMIN', status: 'ACTIVE', joinedAt: new Date('2026-01-01'), nickname: null, canCreateTasks: true, canApproveTasks: true },
      { id: 'm_solo3', familyId: 'f3', userId: 'u_solo', role: 'ADMIN', status: 'ACTIVE', joinedAt: new Date('2026-01-01'), nickname: null, canCreateTasks: true, canApproveTasks: true },
    ] as any[],
    records: [
      { familyId: 'f1', kind: 'notifications', data: { memberId: 'm_ana' } },
      { familyId: 'f1', kind: 'notifications', data: { memberId: 'm_beto' } },
      { familyId: 'f1', kind: 'score', data: { memberId: 'm_ana' } },
      { familyId: 'f1', kind: 'timeline', data: { memberId: 'm_ana' } },
      { familyId: 'f2', kind: 'tasks', data: { memberId: 'x' } },
    ] as any[],
    invitations: [{ familyId: 'f2', status: 'ACTIVE' }] as any[],
  };
  const pick = (m: any, where: any) => Object.entries(where).every(([k, v]: any) => (v && typeof v === 'object' && 'not' in v ? m[k] !== v.not : m[k] === v));
  const tx: any = {
    familyMember: {
      findMany: async ({ where }: any) =>
        db.members.filter((m) => pick(m, where)).map((m) => ({
          ...m,
          family: { ...db.families.find((f) => f.id === m.familyId), members: db.members.filter((x) => x.familyId === m.familyId && x.status === 'ACTIVE').sort((a, b) => a.joinedAt - b.joinedAt) },
        })),
      update: async ({ where, data }: any) => Object.assign(db.members.find((m) => m.id === where.id), data),
      updateMany: async ({ where, data }: any) => db.members.filter((m) => pick(m, where)).forEach((m) => Object.assign(m, data)),
    },
    familyRecord: { deleteMany: async ({ where }: any) => (db.records = db.records.filter((r) => r.familyId !== where.familyId)) },
    familyInvitation: { updateMany: async ({ where, data }: any) => db.invitations.filter((i) => pick(i, where)).forEach((i) => Object.assign(i, data)) },
    family: { update: async ({ where, data }: any) => Object.assign(db.families.find((f) => f.id === where.id)!, data) },
    notification: { deleteMany: async () => 0 },
    auditLog: { updateMany: async () => 0 },
    user: { update: async ({ where, data }: any) => Object.assign(db.users.find((u) => u.id === where.id)!, data) },
    async $executeRaw(_s: TemplateStringsArray, familyId: string, kinds: string[], memberId: string) {
      db.records = db.records.filter((r) => !(r.familyId === familyId && kinds.includes(r.kind) && r.data.memberId === memberId));
      return 1;
    },
  };
  const prisma: any = {
    user: { findUnique: async ({ where }: any) => db.users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null },
    // Transação "de mentira" com desfazer: copia o estado e restaura se falhar.
    async $transaction(fn: (t: any) => Promise<unknown>) {
      const snap = JSON.stringify({ ...db, members: db.members });
      try {
        return await fn(tx);
      } catch (e) {
        const back = JSON.parse(snap, (k, v) => (k === 'joinedAt' ? new Date(v) : v));
        Object.assign(db, back);
        throw e;
      }
    },
  };
  return { db, prisma };
}

async function rejects(p: Promise<unknown>, status: number, code: string) {
  try { await p; } catch (e: any) { expect(e.status).toBe(status); expect(e.response.code).toBe(code); return; }
  throw new Error('deveria ter falhado');
}

describe('AccountService (exclusão de conta)', () => {
  it('senha errada não exclui nada', async () => {
    const { db, prisma } = await fakeDb();
    const svc = new AccountService(prisma);
    await rejects(svc.deleteById('u_ana', 'errada123'), 403, 'INVALID_PASSWORD');
    await rejects(svc.deleteByCredentials('ninguem@x.com', 'segredo123'), 401, 'INVALID_CREDENTIALS');
    expect(db.users[0].name).toBe('Ana');
  });

  it('administradora sai: a responsável mais antiga assume e só os registros pessoais somem', async () => {
    const { db, prisma } = await fakeDb();
    const svc = new AccountService(prisma);
    const r = await svc.deleteByCredentials('U_ANA@x.com ', 'segredo123');
    expect(r.transferredFamilies[0].newAdminMemberId).toBe('m_beto');
    expect(db.members.find((m) => m.id === 'm_beto').role).toBe('ADMIN');
    expect(db.members.find((m) => m.id === 'm_ana').status).toBe('REMOVED');
    expect(db.members.find((m) => m.id === 'm_ana').nickname).toBe(null);
    const kinds = db.records.filter((x) => x.familyId === 'f1').map((x) => `${x.kind}:${x.data.memberId}`).sort().join(',');
    expect(kinds).toBe('notifications:m_beto,score:m_ana');
    const u = db.users.find((x) => x.id === 'u_ana')!;
    expect(u.name).toBe('Conta excluída');
    expect(u.email).toBe('excluida-u_ana@excluida.invalid');
    expect(u.status).toBe('INACTIVE');
    expect(u.refreshTokenHash).toBe(null);
    expect(await bcrypt.compare('segredo123', u.passwordHash)).toBe(false);
  });

  it('única pessoa da família: a família é encerrada e os registros apagados', async () => {
    const { db, prisma } = await fakeDb();
    db.members = db.members.filter((m) => m.id !== 'm_solo3');
    const svc = new AccountService(prisma);
    const r = await svc.deleteById('u_solo', 'segredo123');
    expect(r.closedFamilies).toBe(1);
    const f2 = db.families.find((f) => f.id === 'f2')!;
    expect(f2.status).toBe('ARCHIVED');
    expect(f2.name).toBe('Família encerrada');
    expect(db.records.some((x) => x.familyId === 'f2')).toBe(false);
    expect(db.invitations[0].status).toBe('REVOKED');
  });

  it('sem outra pessoa adulta para assumir, recusa e não muda nada', async () => {
    const { db, prisma } = await fakeDb();
    db.members.push({ id: 'm_kid', familyId: 'f3', userId: 'u_caio', role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date('2026-02-01'), nickname: null });
    const svc = new AccountService(prisma);
    await rejects(svc.deleteById('u_solo', 'segredo123'), 422, 'LAST_ADMIN_NO_SUCCESSOR');
    expect(db.users.find((u) => u.id === 'u_solo')!.status).toBe('ACTIVE');
    expect(db.families.find((f) => f.id === 'f2')!.status).toBe('ACTIVE');
    expect(db.members.find((m) => m.id === 'm_solo').status).toBe('ACTIVE');
  });

  it('participante sai sem mexer na administração', async () => {
    const { db, prisma } = await fakeDb();
    const svc = new AccountService(prisma);
    const r = await svc.deleteById('u_caio', 'segredo123');
    expect(r.transferredFamilies.length).toBe(0);
    expect(db.members.find((m) => m.id === 'm_ana').role).toBe('ADMIN');
    expect(db.members.find((m) => m.id === 'm_caio').status).toBe('REMOVED');
  });
});
