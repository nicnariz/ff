# ADR 002 — Associação, autorização e convites de família

**Status:** aceito.

Papéis e permissões pertencem a `FamilyMember`, pois um mesmo usuário pode ter responsabilidades diferentes em cada família. Cada operação recebe o `familyId` na rota e o serviço verifica uma associação ativa antes de consultar ou alterar dados daquele escopo.

A família ativa é uma preferência local do aplicativo (`activeFamilyId` no Secure Store), nunca uma autorização global no backend. O servidor continua validando todas as rotas por associação.

Os convites armazenam apenas SHA-256 do código aleatório e um prefixo curto para exibição mascarada. O código completo é apresentado somente na criação. A reentrada de um membro removido reativa a associação existente e preserva seu histórico.
