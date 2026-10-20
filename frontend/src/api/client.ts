import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ApiCustomer = { id: number; email: string; full_name: string; phone: string };
export type ApiSession = { customer: ApiCustomer; access: string; refresh: string };
export type Rider = { id: number; email: string; full_name: string; phone: string; vehicle: string; available: boolean };
export type RiderDelivery = {
  id: string; order_reference: string; status: string; status_label: string; customer_name: string; customer_phone: string;
  delivery_address: Record<string, string>; pharmacy_name: string; pharmacy_address: string; payment_method: string;
  amount_due: string; cash_collected: boolean; proof_uploaded: boolean; notes: string;
  events: { status: string; note: string; created_at: string }[]; created_at: string; updated_at: string;
};
let accessToken = '';
let refreshToken = '';
const REFRESH_KEY = 'medifind.refresh';

async function saveRefresh(value: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') value ? window.sessionStorage.setItem(REFRESH_KEY, value) : window.sessionStorage.removeItem(REFRESH_KEY);
  } else if (value) await SecureStore.setItemAsync(REFRESH_KEY, value);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}
async function readRefresh() {
  if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.sessionStorage.getItem(REFRESH_KEY) || '' : '';
  return await SecureStore.getItemAsync(REFRESH_KEY) || '';
}

const apiBase = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export class ApiError extends Error { constructor(message: string, readonly status = 0) { super(message); } }

function detailMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const row = body as Record<string, unknown>;
    const value = row.detail ?? Object.values(row)[0];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(String).join(' ');
  }
  return 'The service could not complete this request. Please try again.';
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try { response = await fetch(`${apiBase}${path}`, { ...init, headers }); }
  catch { throw new ApiError(`Can't reach the MediFind service at ${apiBase}. Start the backend or check EXPO_PUBLIC_API_URL.`); }
  if (response.status === 401 && retry && refreshToken && !path.includes('/token')) {
    const renewed = await fetch(`${apiBase}/api/auth/token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: refreshToken }) }).catch(() => null);
    if (renewed?.ok) {
      const tokens = await renewed.json() as { access: string; refresh?: string };
      accessToken = tokens.access;
      if (tokens.refresh) { refreshToken = tokens.refresh; await saveRefresh(refreshToken); }
      return request<T>(path, init, false);
    }
    await clearSession();
  }
  if (!response.ok) {
    let body: unknown = null;
    try { body = await response.json(); } catch { /* response has no JSON body */ }
    throw new ApiError(detailMessage(body), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function setSession(session: Pick<ApiSession, 'access' | 'refresh'>) { accessToken = session.access; refreshToken = session.refresh; await saveRefresh(refreshToken); }
export async function clearSession() { accessToken = ''; refreshToken = ''; await saveRefresh(''); }
export function hasSession() { return !!accessToken; }
async function restoreSession() {
  refreshToken = await readRefresh();
  if (!refreshToken) return null;
  const response = await fetch(`${apiBase}/api/auth/token/refresh/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: refreshToken }) }).catch(() => null);
  if (!response?.ok) { await clearSession(); return null; }
  const tokens = await response.json() as { access: string; refresh?: string };
  accessToken = tokens.access;
  if (tokens.refresh) refreshToken = tokens.refresh;
  await saveRefresh(refreshToken);
  try { return await api.me(); } catch { await clearSession(); return null; }
}
export const api = {
  register: (payload: { email: string; password: string; full_name: string; phone: string }) => request<ApiSession>('/api/auth/register/', { method: 'POST', body: JSON.stringify(payload) }, false),
  login: (payload: { email: string; password: string }) => request<ApiSession>('/api/auth/token/', { method: 'POST', body: JSON.stringify(payload) }, false),
  riderLogin: (payload: { email: string; password: string }) => request<{ rider: Rider; access: string; refresh: string }>('/api/rider/token/', { method: 'POST', body: JSON.stringify(payload) }, false),
  riderMe: () => request<Rider>('/api/rider/me/'),
  riderSetAvailability: (available: boolean) => request<Rider>('/api/rider/me/', { method: 'PATCH', body: JSON.stringify({ available }) }),
  riderDeliveries: (bucket = 'all') => request<RiderDelivery[]>(`/api/rider/deliveries/${bucket === 'all' ? '' : `?bucket=${bucket}`}`),
  riderAction: (id: string, payload: Record<string, string | boolean>, proof?: { uri: string; name: string; mimeType: string }) => {
    if (!proof) return request<RiderDelivery>(`/api/rider/deliveries/${encodeURIComponent(id)}/action/`, { method: 'POST', body: JSON.stringify(payload) });
    const body = new FormData();
    for (const [key, value] of Object.entries(payload)) body.append(key, String(value));
    body.append('proof', { uri: proof.uri, name: proof.name, type: proof.mimeType } as unknown as Blob);
    return request<RiderDelivery>(`/api/rider/deliveries/${encodeURIComponent(id)}/action/`, { method: 'POST', body });
  },
  riderReportIssue: (id: string, payload: { reason: string; details: string }, photo?: { uri: string; name: string; mimeType: string }) => {
    if (!photo) return request<{ issue: { id: number; reason: string; details: string }; delivery: RiderDelivery }>(`/api/rider/deliveries/${encodeURIComponent(id)}/issues/`, { method: 'POST', body: JSON.stringify(payload) });
    const body = new FormData();
    body.append('reason', payload.reason);
    body.append('details', payload.details);
    body.append('photo', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
    return request<{ issue: { id: number; reason: string; details: string }; delivery: RiderDelivery }>(`/api/rider/deliveries/${encodeURIComponent(id)}/issues/`, { method: 'POST', body });
  },
  customerDeliveryCode: (orderRef: string) => request<{ code: string; delivery_status: string }>(`/api/customer/orders/${encodeURIComponent(orderRef)}/delivery-code/`),
  me: () => request<ApiCustomer>('/api/auth/me/'),
  updateMe: (payload: { full_name: string; phone: string }) => request<ApiCustomer>('/api/auth/me/', { method: 'PATCH', body: JSON.stringify(payload) }),
  logout: async () => { if (refreshToken) await request<void>('/api/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh: refreshToken }) }, false).catch(() => undefined); await clearSession(); },
  restoreSession,
  requestPasswordReset: (email: string) => request<{ detail: string }>('/api/auth/password-reset/', { method: 'POST', body: JSON.stringify({ email }) }, false),
  confirmPasswordReset: (uid: string, token: string, new_password: string) => request<{ detail: string }>('/api/auth/password-reset/confirm/', { method: 'POST', body: JSON.stringify({ uid, token, new_password }) }, false),
  listOrders: <T>() => request<{ results?: T[] } | T[]>('/api/customer/orders/'),
  saveOrder: <T>(external_id: string, data: T) => request('/api/customer/orders/', { method: 'POST', body: JSON.stringify({ external_id, data }) }),
  listPrescriptions: <T>() => request<{ results?: T[] } | T[]>('/api/customer/prescriptions/'),
  savePrescription: <T>(external_id: string, data: T, file?: { uri: string; name: string; mimeType: string }) => {
    const body = new FormData();
    body.append('external_id', external_id);
    body.append('data', JSON.stringify(data));
    if (file) body.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    return request('/api/customer/prescriptions/', { method: 'POST', body });
  },
};
