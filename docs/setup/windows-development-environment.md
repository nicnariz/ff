# Ambiente de desenvolvimento no Windows

## Verificacoes

```powershell
git --version
docker --version
docker compose version
psql --version
```

O PostgreSQL nativo e opcional. Com o Docker Desktop instalado e em execucao, o servico `postgres` do `docker-compose.yml` fornece o banco do projeto.

## Banco local

```powershell
docker compose up -d
Copy-Item .env.example apps/api/.env
pnpm db:generate
pnpm db:migrate
```

Use um banco separado para testes e defina `DATABASE_URL_TEST` com um nome que contenha `test`. Os scripts recusam uma URL igual a `DATABASE_URL` ou que aparente ser de producao.

## GitHub

Crie um repositorio vazio no GitHub e conecte-o sem inventar credenciais ou URL:

```powershell
git remote add origin <URL_DO_REPOSITORIO>
git branch -M main
git push -u origin main
```

Depois acompanhe o workflow **CI** na aba Actions. No estado atual, ele evidenciara como pendentes as suites PostgreSQL de integracao e e2e ate que elas sejam implementadas.
