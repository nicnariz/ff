import { create } from 'zustand';
import { hasSession, logout } from './services/auth';
import { useFamilyStore } from './family-store';
type AuthState = { authenticated: boolean; loaded: boolean; restore: () => Promise<void>; signedIn: () => void; signOut: () => Promise<void> };
export const useAuthStore = create<AuthState>((set) => ({
  authenticated: false, loaded: false,
  restore: async () => set({ authenticated: await hasSession(), loaded: true }),
  signedIn: () => set({ authenticated: true, loaded: true }),
  signOut: async () => { await logout(); await useFamilyStore.getState().clear(); set({ authenticated: false, loaded: true }); },
}));
