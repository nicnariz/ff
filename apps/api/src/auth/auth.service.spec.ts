import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';

const user = { id: 'user-1', name: 'Ana', email: 'ana@example.com', passwordHash: '', refreshTokenHash: null, birthDate: null, avatarUrl: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };
describe('AuthService', () => {
  let service: AuthService; const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } }; const jwt = { signAsync: jest.fn().mockResolvedValueOnce('access').mockResolvedValueOnce('refresh'), verifyAsync: jest.fn() }; const config = { getOrThrow: jest.fn((key: string) => key.includes('ACCESS') ? 'access-secret' : 'refresh-secret') };
  beforeEach(async () => { jest.clearAllMocks(); const module = await Test.createTestingModule({ providers: [AuthService, { provide: PrismaService, useValue: prisma }, { provide: JwtService, useValue: jwt }, { provide: ConfigService, useValue: config }] }).compile(); service = module.get(AuthService); });
  it('registers a user and omits password fields', async () => { prisma.user.findUnique.mockResolvedValue(null); prisma.user.create.mockResolvedValue({ ...user, passwordHash: await bcrypt.hash('password123', 4) }); prisma.user.update.mockResolvedValue(user); const result = await service.register({ name: 'Ana', email: user.email, password: 'password123' }); expect(result.user).not.toHaveProperty('passwordHash'); expect(result.accessToken).toBe('access'); });
  it('rejects duplicate email', async () => { prisma.user.findUnique.mockResolvedValue(user); await expect(service.register({ name: 'Ana', email: user.email, password: 'password123' })).rejects.toBeInstanceOf(ConflictException); });
  it('rejects invalid credentials', async () => { prisma.user.findUnique.mockResolvedValue(null); await expect(service.login({ email: user.email, password: 'password123' })).rejects.toBeInstanceOf(UnauthorizedException); });
});
