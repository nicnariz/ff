import { Body, Controller, Get, Header, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DeleteAccountDto, DeleteByCredentialsDto } from './account.dto';
import { AccountService, AttemptLimiter } from './account.service';
import { deletionPage, privacyPage } from './pages';

@ApiTags('account')
@Controller('account')
export class AccountController {
  private readonly limiter = new AttemptLimiter();
  constructor(private readonly account: AccountService) {}

  @Post('delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exclui a conta de quem está logado (pede a senha)' })
  delete(@Req() r: Request & { user: JwtPayload }, @Body() b: DeleteAccountDto) {
    this.limiter.check(`u:${r.user.sub}`);
    return this.account.deleteById(r.user.sub, b.password);
  }

  @Post('delete-by-credentials')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exclui a conta pela página web (e-mail e senha)' })
  deleteByCredentials(@Req() r: Request, @Body() b: DeleteByCredentialsDto) {
    this.limiter.check(`ip:${r.ip}`);
    this.limiter.check(`e:${b.email.toLowerCase()}`);
    return this.account.deleteByCredentials(b.email, b.password);
  }
}

/** Páginas públicas (fora de /api/v1): política de privacidade e exclusão de conta. */
@Controller()
export class PublicPagesController {
  constructor(private readonly config: ConfigService) {}

  private info() {
    return {
      controller: this.config.get<string>('PRIVACY_CONTROLLER_NAME') || 'Família Feliz',
      email: this.config.get<string>('PRIVACY_CONTACT_EMAIL') || '',
    };
  }

  @Get('privacidade')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  privacy() {
    return privacyPage(this.info());
  }

  @Get('excluir-conta')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  deletion() {
    return deletionPage(this.info());
  }
}
