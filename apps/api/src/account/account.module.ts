import { Module } from '@nestjs/common';
import { AccountController, PublicPagesController } from './account.controller';
import { AccountService } from './account.service';

@Module({ controllers: [AccountController, PublicPagesController], providers: [AccountService] })
export class AccountModule {}
