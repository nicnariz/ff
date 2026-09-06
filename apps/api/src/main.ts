import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const config = new DocumentBuilder().setTitle('Família Feliz API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  const effectivePort = process.env.PORT ?? 3000;
  process.once('beforeExit', (exitCode) => console.log(JSON.stringify({ event: 'PROCESS_BEFORE_EXIT', exitCode, pid: process.pid })));
  process.once('exit', (exitCode) => console.log(JSON.stringify({ event: 'PROCESS_EXIT', exitCode, pid: process.pid })));
  await app.listen(effectivePort);
  const server = app.getHttpServer();
  const diagnostic = (phase: string) => {
    const address = server.address();
    const addressType = typeof address === 'string' ? 'string' : address === null ? 'null' : 'object';
    console.log(JSON.stringify({
      event: 'HTTP_LISTENER_DIAGNOSTIC', phase, portConfigured: effectivePort,
      portType: typeof effectivePort, serverListening: server.listening, addressType,
      boundAddress: typeof address === 'object' && address ? address.address : address,
      boundPort: typeof address === 'object' && address ? address.port : undefined,
      addressFamily: typeof address === 'object' && address ? address.family : undefined,
      pid: process.pid, nodeVersion: process.version,
    }));
  };
  server.on('error', (error: NodeJS.ErrnoException) => { const details = error as NodeJS.ErrnoException & { address?: string; port?: number }; console.log(JSON.stringify({ event: 'HTTP_SERVER_ERROR', name: details.name, message: details.message, code: details.code, errno: details.errno, syscall: details.syscall, address: details.address, port: details.port })); });
  server.on('close', () => console.log(JSON.stringify({ event: 'HTTP_SERVER_CLOSE', pid: process.pid })));
  diagnostic('IMMEDIATE_AFTER_LISTEN');
  setTimeout(() => diagnostic('POST_START_PERSISTENCE'), 5000);
}
void bootstrap();
