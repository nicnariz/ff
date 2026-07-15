# Arquitetura

O repositório usa um monorepo pnpm com aplicações independentes e pacotes compartilhados.

- `apps/mobile`: cliente Expo/React Native e Expo Router.
- `apps/api`: API REST NestJS. Controllers adaptam HTTP; serviços concentram casos de uso.
- `packages/types`: contratos TypeScript que podem ser compartilhados sem dependência de framework.

A API é modular por domínio. O primeiro módulo, `auth`, usa Prisma como camada de persistência e nunca retorna hashes ou tokens armazenados. A autorização futura deverá validar associação ativa à família em todos os módulos que recebam `familyId`.

Os módulos `families` e `invitations` agora validam a associação ativa a cada operação. `ADMIN` administra dados da família; permissões granulares de `FamilyMember` ficam prontas para regras futuras de responsáveis auxiliares.

As entidades do Prisma preservam histórico por status e timestamps; `TaskAssignment` representa cada ocorrência real de uma tarefa recorrente.
