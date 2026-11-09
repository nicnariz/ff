// Datas do dia a dia ("hoje", semana, horário de silêncio) seguem o horário de Brasília.
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Atrás do proxy do Railway: o IP real vem no X-Forwarded-For (usado no limite de tentativas).
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api/v1', { exclude: ['privacidade', 'excluir-conta'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const config = new DocumentBuilder().setTitle('Família Feliz API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
