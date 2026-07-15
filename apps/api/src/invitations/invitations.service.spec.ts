import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
describe('InvitationsService', () => { const prisma: any = { familyInvitation: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() }, familyMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, $transaction: jest.fn((f: any) => f(prisma)) }; const families: any = { access: jest.fn() }; let service: InvitationsService;
 beforeEach(() => { jest.clearAllMocks(); service = new InvitationsService(prisma, families); families.access.mockResolvedValue({ role: 'ADMIN' }); });
 it('creates a hashed invitation code', async () => { prisma.familyInvitation.create.mockResolvedValue({ id: 'i1' }); const result = await service.create('u1','f1',{role:'MEMBER',expiresInHours:1,maximumUses:1}); expect(result.code).toBeTruthy(); expect(prisma.familyInvitation.create.mock.calls[0][0].data.codeHash).not.toBe(result.code); });
 it('blocks a non-admin from creating invitations', async () => { families.access.mockResolvedValue({role:'MEMBER'}); await expect(service.create('u1','f1',{role:'MEMBER',expiresInHours:1,maximumUses:1})).rejects.toBeInstanceOf(ForbiddenException); });
 it('rejects expired invitation acceptance', async () => { prisma.familyInvitation.findUnique.mockResolvedValue({ status:'ACTIVE', expiresAt:new Date(0), currentUses:0, maximumUses:1 }); await expect(service.accept('u2','code')).rejects.toBeInstanceOf(UnprocessableEntityException); });
});
