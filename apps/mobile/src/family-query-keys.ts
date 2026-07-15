export const familyQueryKeys = {
  list: ['families'] as const,
  detail: (familyId: string) => ['family', familyId] as const,
  members: (familyId: string, page = 1) => ['family-members', familyId, page] as const,
  invitations: (familyId: string) => ['family-invitations', familyId] as const,
};
