import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { FamilySummary, getActiveFamily, setActiveFamily } from './services/families';

type FamilyState = { families: FamilySummary[]; activeFamilyId: string | null; loading: boolean; setFamilies: (families: FamilySummary[]) => void; select: (id: string) => Promise<void>; restore: (families: FamilySummary[]) => Promise<void>; clear: () => Promise<void>; };
export const useFamilyStore = create<FamilyState>((set) => ({ families: [], activeFamilyId: null, loading: true, setFamilies: (families) => set({ families }), select: async (id) => { await setActiveFamily(id); set({ activeFamilyId: id }); }, restore: async (families) => { const stored = await getActiveFamily(); const valid = stored && families.some((family) => family.id === stored) ? stored : families.length === 1 ? families[0].id : null; if (valid) await setActiveFamily(valid); else await SecureStore.deleteItemAsync('activeFamilyId'); set({ families, activeFamilyId: valid, loading: false }); }, clear: async () => { await SecureStore.deleteItemAsync('activeFamilyId'); set({ activeFamilyId: null, families: [], loading: false }); } }));
