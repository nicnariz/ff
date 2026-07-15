# App Familia Feliz

Monorepo do MVP para gestao de responsabilidades familiares, com Expo/React Native, NestJS, Prisma e PostgreSQL.

## Inicio rapido

Requisitos: Node.js 22, pnpm 9 e Docker Desktop.

```powershell
corepack enable
pnpm install
Copy-Item .env.example apps/api/.env
Copy-Item .env.example apps/mobile/.env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:mobile
```

API: `http://localhost:3000/api/v1`. Swagger: `http://localhost:3000/docs`.

## Validacao

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm prisma:validate
pnpm db:generate
```

Com `DATABASE_URL_TEST` apontando para um PostgreSQL exclusivo de testes:

```powershell
pnpm db:test:migrate
pnpm test:integration
pnpm test:e2e
```

Os comandos de integracao e e2e falham explicitamente enquanto as suites reais nao forem implementadas; eles nunca usam `DATABASE_URL` como substituta silenciosa.

## Fluxo de familias no mobile

O aplicativo restaura a sessao e a familia ativa, valida a selecao contra a lista atual e direciona o usuario para login, setup, selecao ou inicio. Detalhes, membros e convites usam chaves TanStack Query que incluem `familyId`; a troca cancela e remove consultas da familia anterior. O fluxo inclui criacao de familia, entrada por convite, criacao de convite para ADMIN, membros paginados, troca de familia e logout.

Consulte [a arquitetura](docs/architecture/overview.md), a [ADR 002](docs/decisions/002-family-membership-and-authorization.md) e o [guia do Windows](docs/setup/windows-development-environment.md).

## Validacao da segunda entrega

| Item | Situacao local |
|---|---|
| Typecheck e lint | Aprovados localmente |
| Testes unitarios da API | 10 aprovados, 0 falhos, 0 ignorados |
| Testes unitarios mobile | 23 aprovados, 0 falhos, 0 ignorados |
| Build da API e export web do Expo | Aprovados localmente |
| Prisma validate e generate | Aprovados com a URL local de exemplo; nenhuma conexao foi realizada |
| Migracao PostgreSQL | Bloqueada sem Docker/PostgreSQL |
| Integracao, e2e HTTP e concorrencia real | Pendentes de implementacao e PostgreSQL |
| GitHub Actions | Workflow criado, ainda sem evidencia de execucao desta rodada |

## Checklist do Product Owner

- [x] Git instalado
- [ ] Docker Desktop instalado
- [ ] Docker em execucao
- [x] Repositorio Git inicializado
- [x] Repositorio remoto criado
- [x] Origin configurado
- [x] Push inicial realizado
- [ ] GitHub Actions executado com sucesso
- [ ] Migracao aplicada no PostgreSQL de teste
- [ ] Testes de integracao aprovados
- [ ] Testes e2e aprovados
- [ ] Teste concorrente aprovado

A segunda entrega ainda nao esta integralmente concluida, pois depende da implementacao e execucao real dos testes PostgreSQL e do CI.
