export type NavigationTarget = 'LOADING' | 'LOGIN' | 'FAMILY_SETUP' | 'FAMILY_SELECTION' | 'APP';
export interface NavigationContext { sessionLoaded: boolean; authenticated: boolean; familiesLoaded: boolean; familyCount: number; activeFamilyId: string | null }
export function resolveNavigationTarget(state: NavigationContext): NavigationTarget {
  if (!state.sessionLoaded || (state.authenticated && !state.familiesLoaded)) return 'LOADING';
  if (!state.authenticated) return 'LOGIN';
  if (state.familyCount === 0) return 'FAMILY_SETUP';
  if (!state.activeFamilyId) return state.familyCount === 1 ? 'LOADING' : 'FAMILY_SELECTION';
  return 'APP';
}
