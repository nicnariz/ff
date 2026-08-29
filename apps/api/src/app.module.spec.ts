import { Test } from '@nestjs/testing';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://contract:contract@127.0.0.1:5432/contract',
  JWT_ACCESS_SECRET: '01234567890123456789012345678901',
  JWT_REFRESH_SECRET: '01234567890123456789012345678901',
});

const { AppModule } = require('./app.module');

describe('AppModule', () => {
  it('compiles feature modules with the shared Prisma provider', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.close();
  });
});
