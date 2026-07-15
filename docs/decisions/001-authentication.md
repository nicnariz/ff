# ADR 001 — JWT de curta duração e refresh token com hash

**Status:** aceito.

O access token expira em 15 minutos por padrão. O refresh token é assinado por segredo separado e somente seu hash bcrypt é persistido. Ao renovar a sessão, o refresh token é rotacionado. Isso limita o impacto de vazamento de um token e permite invalidar sessões ao limpar o hash.
