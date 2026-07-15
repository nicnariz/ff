export type UserRole = 'ADMIN' | 'GUARDIAN' | 'MEMBER';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}
