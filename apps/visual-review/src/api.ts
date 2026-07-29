import type { PortalData, ReviewerRole, ReviewStatus } from './types';

const tokenKey = 'familia-feliz-visual-review-token';
const baseUrl = import.meta.env.BASE_URL;
const staticMode = import.meta.env.PROD;

export const getToken = () => sessionStorage.getItem(tokenKey) ?? '';
export const setToken = (token: string) => sessionStorage.setItem(tokenKey, token);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Falha inesperada.' }));
    throw new Error(body.message ?? `Falha HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const loadPortal = () =>
  staticMode
    ? request<PortalData>(`${baseUrl}data/portal.json`)
    : request<PortalData>('/api/portal');

export const saveReview = (payload: {
  key: string;
  decision: Exclude<ReviewStatus, 'PENDING'>;
  comment: string;
  reviewer: { name: string; role: ReviewerRole };
}) => {
  if (staticMode) throw new Error('A publicação remota é somente leitura. Use o fluxo autenticado do GitHub.');
  return request<PortalData>('/api/reviews', { method: 'POST', body: JSON.stringify(payload) });
};

export const promote = (payload: { reviewer: { name: string; role: 'PRODUCT_OWNER' } }) => {
  if (staticMode) throw new Error('Promoção indisponível na publicação estática.');
  return request<{ message: string }>('/api/promote', { method: 'POST', body: JSON.stringify(payload) });
};

export async function downloadExport(format: 'pdf' | 'html' | 'json' | 'md') {
  if (staticMode) {
    window.open(`${baseUrl}data/portal.json`, '_blank', 'noopener,noreferrer');
    return;
  }
  const response = await fetch(`/api/export/${format}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!response.ok) throw new Error('Não foi possível exportar o relatório.');
  const blob = await response.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `visual-review-1.0.0.${format === 'md' ? 'md' : format}`;
  link.click();
  URL.revokeObjectURL(link.href);
}
