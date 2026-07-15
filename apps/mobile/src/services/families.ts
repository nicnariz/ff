import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export interface FamilySummary { id: string; name: string; avatarUrl: string | null; role: 'ADMIN' | 'GUARDIAN' | 'MEMBER'; memberCount: number; }
async function request<T>(path: string, init?: RequestInit): Promise<T> { const token = await SecureStore.getItemAsync('accessToken'); const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } }); if (!response.ok) throw new Error('Family request failed'); return response.json() as Promise<T>; }
export const listFamilies = () => request<FamilySummary[]>('/families');
export const createFamily = (name: string) => request<FamilySummary>('/families', { method: 'POST', body: JSON.stringify({ name }) });
export const setActiveFamily = (id: string) => SecureStore.setItemAsync('activeFamilyId', id);
export const getActiveFamily = () => SecureStore.getItemAsync('activeFamilyId');
export const acceptInvitation = (code: string) => request<{ familyId: string }>(`/invitations/${code}/accept`, { method: 'POST' });
