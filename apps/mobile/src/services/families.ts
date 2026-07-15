import * as SecureStore from 'expo-secure-store';
import { apiRequest } from './http';

export type FamilyRole = 'ADMIN' | 'GUARDIAN' | 'MEMBER';
export interface FamilySummary { id: string; name: string; avatarUrl: string | null; role: FamilyRole; memberCount: number }
export interface FamilyDetails extends FamilySummary { permissions: { canCreateTasks: boolean; canApproveTasks: boolean } }
export interface FamilyMember { id: string; nickname: string | null; role: FamilyRole; status: string; canCreateTasks: boolean; canApproveTasks: boolean; user: { id: string; name: string; avatarUrl: string | null } }
export interface MembersPage { items: FamilyMember[]; meta: { page: number; limit: number; total: number } }
export interface InvitationPreview { familyName: string; role: FamilyRole; expiresAt: string; status: string }
export interface Invitation { id: string; code: string; role: FamilyRole; expiresAt: string; maximumUses: number; currentUses: number; status: string }

export const listFamilies = () => apiRequest<FamilySummary[]>('/families');
export const createFamily = (name: string) => apiRequest<FamilySummary>('/families', { method: 'POST', body: JSON.stringify({ name }) });
export const getFamily = (id: string) => apiRequest<FamilyDetails>(`/families/${id}`);
export const listMembers = (id: string, page = 1) => apiRequest<MembersPage>(`/families/${id}/members?page=${page}&limit=20`);
export const previewInvitation = (code: string) => apiRequest<InvitationPreview>(`/invitations/${encodeURIComponent(code)}`, undefined, false);
export const acceptInvitation = (code: string) => apiRequest<{ familyId: string }>(`/invitations/${encodeURIComponent(code)}/accept`, { method: 'POST' });
export const createInvitation = (familyId: string, input: { role: Exclude<FamilyRole, 'ADMIN'>; expiresInHours: number; maximumUses: number }) => apiRequest<Invitation>(`/families/${familyId}/invitations`, { method: 'POST', body: JSON.stringify(input) });
export const listInvitations = (familyId: string) => apiRequest<Invitation[]>(`/families/${familyId}/invitations`);
export const revokeInvitation = (familyId: string, id: string) => apiRequest<void>(`/families/${familyId}/invitations/${id}`, { method: 'DELETE' });
export const setActiveFamily = (id: string) => SecureStore.setItemAsync('activeFamilyId', id);
export const getActiveFamily = () => SecureStore.getItemAsync('activeFamilyId');
