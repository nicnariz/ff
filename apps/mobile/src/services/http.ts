import { getAccessToken, logout } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
export type SessionExpiredHandler = () => void | Promise<void>;
let onSessionExpired: SessionExpiredHandler | undefined;
export const setSessionExpiredHandler = (handler?: SessionExpiredHandler): void => { onSessionExpired = handler; };

export async function apiRequest<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const token = authenticated ? await getAccessToken() : null;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }
  if (response.status === 401) {
    await logout();
    await onSessionExpired?.();
    throw new Error('SESSION_EXPIRED');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string; message?: { code?: string } | string };
    const code = body.code ?? (typeof body.message === 'object' ? body.message.code : undefined);
    throw new Error(code ?? `HTTP_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
