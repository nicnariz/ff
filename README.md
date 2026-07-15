# App Família Feliz

Monorepo do MVP para gestão de tarefas familiares, construído com Expo/React Native e NestJS.

## Requisitos

- Node.js 22 LTS
- pnpm 9 (`corepack enable`)
- Docker Desktop

## Início rápido

```bash
pnpm install
Copy-Item .env.example apps/api/.env
Copy-Item .env.example apps/mobile/.env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:mobile
```

No Windows PowerShell, use os comandos `Copy-Item` acima. Em macOS/Linux, use `cp`.

API: `http://localhost:3000/api/v1`; Swagger: `http://localhost:3000/docs`.

## Comandos

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
```

Consulte [a arquitetura](docs/architecture/overview.md) e a [decisão de autenticação](docs/decisions/001-authentication.md).

## Famílias e convites

As rotas autenticadas permitem criar, listar, consultar e atualizar famílias, listar e administrar membros, e criar/listar/revogar convites. Convites públicos expõem somente nome da família, papel oferecido, validade e situação. Consulte a [ADR 002](docs/decisions/002-family-membership-and-authorization.md).

## Validação da segunda entrega

Executados com sucesso: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @familia-feliz/api build`, `pnpm db:generate` e `pnpm --filter @familia-feliz/api prisma:validate`.

O Docker não está instalado no ambiente atual; por isso a migração não foi aplicada a um PostgreSQL real e testes de integração com banco permanecem bloqueados. Em um ambiente com Docker: inicie `docker compose up -d`, copie `.env.example` para `apps/api/.env`, execute `pnpm db:migrate` e rode os testes de integração quando adicionados.

No aplicativo, a família ativa é persistida no Secure Store. Ao restaurar a sessão, a seleção é usada somente se ainda constar na lista devolvida pela API; caso contrário é removida.
