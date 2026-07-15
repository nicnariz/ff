import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'birthDate' | 'avatarUrl' | 'status' | 'createdAt' | 'updatedAt'>;
export interface AuthResponse { user: SafeUser; accessToken: string; refreshToken: string; }

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({ data: { name: dto.name, email, passwordHash, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined } });
    return this.createSession(user);
  }
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    return this.createSession(user);
  }
  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: JwtPayload;
    try { payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET') }); } catch { throw new UnauthorizedException('Invalid refresh token'); }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash || user.status !== 'ACTIVE' || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) throw new UnauthorizedException('Invalid refresh token');
    return this.createSession(user);
  }
  async profile(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, birthDate: true, avatarUrl: true, status: true, createdAt: true, updatedAt: true } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
  private async createSession(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.config.getOrThrow('JWT_ACCESS_EXPIRES_IN') });
    const refreshToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN') });
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: await bcrypt.hash(refreshToken, 12) } });
    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      birthDate: user.birthDate,
      avatarUrl: user.avatarUrl,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { user: safeUser, accessToken, refreshToken };
  }
}
