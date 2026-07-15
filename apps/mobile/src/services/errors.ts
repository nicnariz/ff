const messages: Record<string, string> = {
  FAMILY_ACCESS_DENIED: 'Voce nao possui acesso a esta familia.', INVITATION_NOT_FOUND: 'Convite nao encontrado.',
  INVITATION_EXPIRED: 'Este convite expirou.', INVITATION_REVOKED: 'Este convite foi revogado.',
  INVITATION_USAGE_LIMIT_REACHED: 'Este convite ja atingiu o limite de utilizacoes.',
  FAMILY_MEMBER_ALREADY_EXISTS: 'Voce ja faz parte desta familia.', NETWORK_ERROR: 'Sem conexao. Verifique sua internet e tente novamente.',
  SESSION_EXPIRED: 'Sua sessao expirou. Entre novamente.', INVALID_CREDENTIALS: 'Confira seu e-mail e senha.',
};
export function friendlyError(error: unknown): string {
  if (error instanceof Error && messages[error.message]) return messages[error.message];
  return 'Nao foi possivel concluir a acao. Tente novamente.';
}
