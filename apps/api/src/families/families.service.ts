import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FamilyMemberRole, MemberStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateFamilyDto, MembersQueryDto, UpdateFamilyDto, UpdateMemberDto } from './dto/family.dto';
@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}
  private normalize(name: string) { return name.trim().replace(/\s+/g, ' '); }
  async create(userId: string, dto: CreateFamilyDto) { const name = this.normalize(dto.name); return this.prisma.$transaction(async tx => { const family = await tx.family.create({ data: { name, invitationCode: randomBytes(12).toString('hex'), createdById: userId } }); await tx.familyMember.create({ data: { familyId: family.id, userId, role: 'ADMIN', canCreateTasks: true, canApproveTasks: true } }); return { id: family.id, name: family.name, role: 'ADMIN', createdAt: family.createdAt }; }); }
  async list(userId: string) { const memberships = await this.prisma.familyMember.findMany({ where: { userId, status: 'ACTIVE', family: { status: 'ACTIVE' } }, include: { family: { include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } } } } }); return memberships.map(m => ({ id: m.family.id, name: m.family.name, avatarUrl: m.family.avatarUrl, role: m.role, memberCount: m.family._count.members })); }
  async access(userId: string, familyId: string) { const member = await this.prisma.familyMember.findUnique({ where: { familyId_userId: { familyId, userId } } }); if (!member || member.status !== 'ACTIVE') throw new ForbiddenException({ code: 'FAMILY_ACCESS_DENIED' }); return member; }
  async details(userId: string, familyId: string) { const member = await this.access(userId, familyId); const family = await this.prisma.family.findUnique({ where: { id: familyId }, include: { _count: { select: { members: { where: { status: 'ACTIVE' } } } } } }); if (!family) throw new NotFoundException({ code: 'FAMILY_NOT_FOUND' }); return { ...family, role: member.role, permissions: { canCreateTasks: member.canCreateTasks, canApproveTasks: member.canApproveTasks }, memberCount: family._count.members }; }
  async update(userId: string, familyId: string, dto: UpdateFamilyDto) { const member = await this.access(userId, familyId); if (member.role !== 'ADMIN') throw new ForbiddenException({ code: 'FAMILY_ACCESS_DENIED' }); return this.prisma.family.update({ where: { id: familyId }, data: { ...(dto.name ? { name: this.normalize(dto.name) } : {}), avatarUrl: dto.avatarUrl } }); }
  async members(userId: string, familyId: string, q: MembersQueryDto) { await this.access(userId, familyId); const where: Prisma.FamilyMemberWhereInput = { familyId, ...(q.status ? { status: q.status } : {}), ...(q.role ? { role: q.role } : {}), ...(q.search ? { OR: [{ nickname: { contains: q.search, mode: 'insensitive' } }, { user: { name: { contains: q.search, mode: 'insensitive' } } }] } : {}) }; const [items, total] = await this.prisma.$transaction([this.prisma.familyMember.findMany({ where, skip: (q.page - 1) * q.limit, take: q.limit, include: { user: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { joinedAt: 'asc' } }), this.prisma.familyMember.count({ where })]); return { items, meta: { page: q.page, limit: q.limit, total } }; }
  /** Permissões padrão de cada papel (usadas quando o papel muda e nada foi informado explicitamente). */
  static defaultPermissions(role: FamilyMemberRole) {
    const manager = role === FamilyMemberRole.ADMIN || role === FamilyMemberRole.GUARDIAN;
    return { canCreateTasks: manager, canApproveTasks: manager };
  }

  async updateMember(userId: string, familyId: string, memberId: string, dto: UpdateMemberDto) {
    const actor = await this.access(userId, familyId);
    if (actor.role !== 'ADMIN') throw new ForbiddenException({ code: 'FAMILY_ACCESS_DENIED' });
    const target = await this.prisma.familyMember.findFirst({ where: { id: memberId, familyId } });
    if (!target) throw new NotFoundException({ code: 'FAMILY_MEMBER_NOT_FOUND' });
    if (target.userId === userId && (dto.role || dto.canCreateTasks !== undefined || dto.canApproveTasks !== undefined || dto.status)) throw new UnprocessableEntityException({ code: 'CANNOT_EDIT_OWN_PERMISSIONS' });
    // A família nunca fica sem administração: rebaixar ou remover o último ADMIN ativo é bloqueado.
    const leavesAdmin = target.role === FamilyMemberRole.ADMIN && ((dto.role !== undefined && dto.role !== FamilyMemberRole.ADMIN) || dto.status === MemberStatus.REMOVED || dto.status === MemberStatus.INACTIVE);
    if (leavesAdmin) {
      const admins = await this.prisma.familyMember.count({ where: { familyId, role: FamilyMemberRole.ADMIN, status: MemberStatus.ACTIVE } });
      if (admins <= 1) throw new UnprocessableEntityException({ code: 'LAST_ADMIN_CANNOT_BE_REMOVED' });
    }
    const data: Prisma.FamilyMemberUpdateInput = { ...dto };
    if (dto.role && dto.role !== target.role) {
      const defaults = FamiliesService.defaultPermissions(dto.role);
      data.canCreateTasks = dto.canCreateTasks ?? defaults.canCreateTasks;
      data.canApproveTasks = dto.canApproveTasks ?? defaults.canApproveTasks;
    }
    // Administração sempre pode criar e aprovar tarefas.
    if ((dto.role ?? target.role) === FamilyMemberRole.ADMIN) {
      data.canCreateTasks = true;
      data.canApproveTasks = true;
    }
    return this.prisma.familyMember.update({ where: { id: memberId }, data });
  }
}
