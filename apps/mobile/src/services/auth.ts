import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const ACCESS_TOKEN = 'accessToken';
const REFRESH_TOKEN = 'refreshToken';

interface AuthResponse { accessToken: string; refreshToken: string }

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error('INVALID_CREDENTIALS');
  const data = await response.json() as AuthResponse;
  await Promise.all([SecureStore.setItemAsync(ACCESS_TOKEN, data.accessToken), SecureStore.setItemAsync(REFRESH_TOKEN, data.refreshToken)]);
}

export const hasSession = async (): Promise<boolean> => Boolean(await SecureStore.getItemAsync(ACCESS_TOKEN));
export const getAccessToken = (): Promise<string | null> => SecureStore.getItemAsync(ACCESS_TOKEN);
export async function logout(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN), SecureStore.deleteItemAsync(REFRESH_TOKEN)]);
}
