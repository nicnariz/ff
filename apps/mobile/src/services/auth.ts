import * as SecureStore from 'expo-secure-store';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
interface AuthResponse { accessToken: string; refreshToken: string; }
export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error('Login failed');
  const data = await response.json() as AuthResponse;
  await SecureStore.setItemAsync('accessToken', data.accessToken);
  await SecureStore.setItemAsync('refreshToken', data.refreshToken);
}
