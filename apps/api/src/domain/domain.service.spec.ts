import { DomainService, parseClientIds } from './domain.service';

// Banco em memória que imita o necessário: transação com trava por família, leitura e gravação de FamilyRecord.
function fakeDb() {
  const people = [
    { id: 'u_ana', name: 'Ana Oliveira', email: 'ana@x.com' },
    { id: 'u_beto', name: 'Beto Oliveira', email: 'beto@x.com' },
    { id: 'u_caio', name: 'Caio Oliveira', email: 'caio@x.com' },
    { id: 'u_fora', name: 'Fora', email: 'fora@x.com' },
  ].map((u) => ({ ...u, createdAt: new Date('2026-01-01') }));
  const member = (id: string, userId: string, role: string, canApproveTasks = false, joined = '2026-01-01') => ({
    id, familyId: 'fam1', userId, role, nickname: null, canApproveTasks, status: 'ACTIVE', joinedAt: new Date(joined), user: people.find((p) => p.id === userId)!,
  });
  const family = {
    id: 'fam1', name: 'Família Oliveira', createdAt: new Date('2026-01-01'),
    members: [member('m_ana', 'u_ana', 'ADMIN', true), member('m_beto', 'u_beto', 'GUARDIAN', true, '2026-01-02'), member('m_caio', 'u_caio', 'MEMBER', false, '2026-01-03')],
  };
  const rows = new Map<string, { familyId: string; kind: string; recordId: string; data: unknown }>();
  const locks = new Map<string, Promise<void>>();
  let writes = 0;

  const prisma: any = {
    async $transaction(fn: (tx: any) => Promise<unknown>) {
      let release: () => void = () => {};
      // Como no Postgres (READ COMMITTED), o que é lido depois da trava já inclui o que outra transação gravou.
      let pending = new Map(rows);
      const tx = {
        async $executeRaw(strings: TemplateStringsArray, ...values: any[]) {
          const sql = strings.join('?');
          if (sql.includes('pg_advisory_xact_lock')) {
            const key = values[0];
            while (locks.has(key)) await locks.get(key);
            locks.set(key, new Promise<void>((r) => (release = () => { locks.delete(key); r(); })));
            pending = new Map(rows);
            return 1;
          }
          if (sql.includes('INSERT INTO "FamilyRecord"')) {
            const [familyId, json] = values;
            for (const x of JSON.parse(json)) pending.set(`${familyId}|${x.k}|${x.r}`, { familyId, kind: x.k, recordId: x.r, data: x.d });
            writes++;
            return 1;
          }
          if (sql.includes('DELETE FROM "FamilyRecord"')) {
            const [json, familyId] = values;
            for (const x of JSON.parse(json)) pending.delete(`${familyId}|${x.k}|${x.r}`);
            writes++;
            return 1;
          }
          throw new Error('SQL inesperado: ' + sql);
        },
        family: { findUnique: async ({ where }: any) => (where.id === family.id ? JSON.parse(JSON.stringify(family), (k, v) => (k === 'joinedAt' || k === 'createdAt' ? new Date(v) : v)) : null) },
        familyRecord: { findMany: async ({ where }: any) => [...pending.values()].filter((r) => r.familyId === where.familyId).map((r) => ({ kind: r.kind, data: JSON.parse(JSON.stringify(r.data)) })) },
      };
      try {
        const out = await fn(tx);
        rows.clear();
        pending.forEach((v, k) => rows.set(k, v));
        return out;
      } finally {
        release();
      }
    },
  };
  return { prisma, rows, family, writes: () => writes };
}

async function rejectsWith(p: Promise<unknown>, status: number, code?: string) {
  try {
    await p;
  } catch (e: any) {
    expect(e.status).toBe(status);
    if (code) expect(e.response.code).toBe(code);
    return e;
  }
  throw new Error('deveria ter falhado');
}

const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const task = (over: Record<string, unknown> = {}) => ({
  title: 'Arrumar a cama', points: 10, recurrence: 'DAILY', weekdays: [], startDate: today(), dueTime: '23:59',
  assigneeIds: ['m_caio'], requiresApproval: true, requiresEvidence: false, essential: false, ...over,
});

describe('DomainService (dia a dia no servidor)', () => {
  it('quem não participa da família não vê nada', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await rejectsWith(svc.state('u_fora', 'fam1'), 403, 'FAMILY_ACCESS_DENIED');
    await rejectsWith(svc.state('u_ana', 'outra'), 404, 'FAMILY_NOT_FOUND');
  });

  it('tarefa criada por um aparelho aparece no outro, com as ocorrências do dia', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    const res = await svc.run('u_ana', 'fam1', 'saveTask', [task()]);
    expect((res.result as any).title).toBe('Arrumar a cama');
    const caio = await svc.state('u_caio', 'fam1');
    expect(caio.tasks.length).toBe(1);
    expect(caio.assignments.some((a) => a.memberId === 'm_caio' && a.date === today())).toBe(true);
  });

  it('criança não cria tarefa (regra no servidor)', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await rejectsWith(svc.run('u_caio', 'fam1', 'saveTask', [task()]), 403, 'FAMILY_ACCESS_DENIED');
  });

  it('conclusão → aprovação credita pontos uma vez só, mesmo com dois aparelhos aprovando juntos', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await svc.run('u_ana', 'fam1', 'saveTask', [task()]);
    const s1 = await svc.state('u_caio', 'fam1');
    const a = s1.assignments.find((x) => x.memberId === 'm_caio' && x.date === today())!;
    await svc.run('u_caio', 'fam1', 'completeAssignment', [a.id]);
    const results = await Promise.allSettled([
      svc.run('u_ana', 'fam1', 'approveAssignment', [a.id]),
      svc.run('u_beto', 'fam1', 'approveAssignment', [a.id]),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(422);
    const s2 = await svc.state('u_caio', 'fam1');
    const credits = s2.score.filter((t) => t.memberId === 'm_caio');
    expect(credits.reduce((n, t) => n + t.amount, 0)).toBe(10);
  });

  it('cada pessoa recebe só as próprias notificações; mesada só para a administração', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await svc.run('u_ana', 'fam1', 'saveTask', [task()]);
    const a = (await svc.state('u_caio', 'fam1')).assignments.find((x) => x.date === today())!;
    await svc.run('u_caio', 'fam1', 'completeAssignment', [a.id]);
    await svc.run('u_ana', 'fam1', 'saveAllowanceConfig', ['m_caio', { baseAmount: 20, frequency: 'WEEKLY', policy: 'PROPORTIONAL', minimumPercent: 0, active: true }]);
    await svc.run('u_ana', 'fam1', 'openPeriod', ['m_caio']);
    const ana = await svc.state('u_ana', 'fam1');
    const beto = await svc.state('u_beto', 'fam1');
    const caio = await svc.state('u_caio', 'fam1');
    expect(ana.notifications.every((n) => n.memberId === 'm_ana')).toBe(true);
    expect(ana.notifications.length > 0).toBe(true);
    expect(caio.notifications.every((n) => n.memberId === 'm_caio')).toBe(true);
    expect(ana.allowancePeriods.length).toBe(1);
    expect(beto.allowancePeriods.length).toBe(0);
    expect(caio.allowancePeriods.length).toBe(1);
    expect(caio.users.find((u) => u.id === 'u_ana')!.email).toBe('');
    expect(caio.users.find((u) => u.id === 'u_caio')!.email).toBe('caio@x.com');
  });

  it('usa os ids criados no aparelho e recusa ids já usados', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    const first = await svc.run('u_ana', 'fam1', 'saveValue', [{ title: 'Gentileza' }], ['val_abcdefgh123']);
    expect(first.state.values[0].id).toBe('val_abcdefgh123');
    await svc.run('u_ana', 'fam1', 'saveValue', [{ title: 'Respeito' }], ['val_abcdefgh123']);
    const s = await svc.state('u_ana', 'fam1');
    expect(s.values.length).toBe(2);
    expect(new Set(s.values.map((v) => v.id)).size).toBe(2);
    expect(JSON.stringify(parseClientIds('val_abcdefgh123, x; drop table, tsk_ok, TSK_UPPER123'))).toBe(JSON.stringify(['val_abcdefgh123']));
  });

  it('erro de regra não grava nada pela metade', async () => {
    const { prisma, rows } = fakeDb();
    const svc = new DomainService(prisma);
    await svc.state('u_ana', 'fam1');
    const before = JSON.stringify([...rows.entries()]);
    await rejectsWith(svc.run('u_ana', 'fam1', 'saveReward', [{ title: 'X', cost: 0, stock: null }]), 422);
    expect(JSON.stringify([...rows.entries()])).toBe(before);
  });

  it('resgate reserva pontos e a administração conclui', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await svc.run('u_ana', 'fam1', 'manualBonus', ['m_caio', 50, 'Ajudou muito']);
    const rw = await svc.run('u_ana', 'fam1', 'saveReward', [{ title: 'Escolher o filme', cost: 30, stock: null }]);
    const red = await svc.run('u_caio', 'fam1', 'redeem', [rw.state.rewards[0].id]);
    const redId = red.state.redemptions[0].id;
    await svc.run('u_ana', 'fam1', 'approveRedemption', [redId]);
    await svc.run('u_ana', 'fam1', 'fulfillRedemption', [redId]);
    const s = await svc.state('u_caio', 'fam1');
    expect(s.redemptions[0].status).toBe('FULFILLED');
  });

  it('operações de conta não passam pelas rotas do dia a dia', async () => {
    const { prisma } = fakeDb();
    const svc = new DomainService(prisma);
    await rejectsWith(svc.run('u_ana', 'fam1', 'createFamily' as any, ['x']), 404);
  });
});
