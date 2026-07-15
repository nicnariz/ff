import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthModule } from './auth/auth.module';
import { FamiliesModule } from './families/families.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({ DATABASE_URL: Joi.string().required(), JWT_ACCESS_SECRET: Joi.string().min(32).required(), JWT_REFRESH_SECRET: Joi.string().min(32).required(), JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'), JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'), PORT: Joi.number().default(3000) }) }), AuthModule, FamiliesModule, InvitationsModule],
  providers: [PrismaService],
})
export class AppModule {}
