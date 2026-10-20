import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

export type ApiCustomer = { id: number; email: string; full_name: string; phone: string; is_staff?: boolean };
export type ApiSession = { customer: ApiCustomer; access: string; refresh: string };
export type AdminEvent = { id: number; actor_email: string; previous_status: string; status: string; notes: string; created_at: string };
export type AdminDocument = { id: number; kind: string; name: string; created_at: string };
export type AdminPharmacy = { id: string; name: string; address: string; applicant: string; email: string; phone: string; status: 'Draft' | 'Pending' | 'Needs Info' | 'Approved' | 'Rejected'; notes: string; version: number; created_at: string; documents: AdminDocument[]; history: AdminEvent[]; point?: { lat: number; lon: number } | null };
export type AdminMedicine = { id: string; name: string; description: string; generic?: string; strength?: string; form?: string; unit?: string; prescription?: boolean; pharmacy: string; pharmacy_id: string; status: 'Pending' | 'Approved' | 'Rejected'; notes: string; version: number; created_at: string; history: AdminEvent[] };
export type PharmacyApplication = Omit<AdminPharmacy, 'status' | 'created_at'> & { status: AdminPharmacy['status'] | 'Draft'; hours: string; is_open: boolean; point?: { lat: number; lon: number } | null };
export type PharmacySession = { application: PharmacyApplication | null; role: 'owner' | 'pharmacist' | 'staff' | null; can_review: boolean };
export type PharmacyMedicine = AdminMedicine & { catalog_id: string; generic: string; strength: string; form: string; unit: string; prescription: boolean; inventory: null | { price: string; stock: number; reserved: number; low_stock: number; available: boolean; version: number } };
export type PharmacyPrescription = { id: number; reference: string; customer: string; status: string; requested: { medicineId: string; quantity: number }[]; approved: { medicineId: string; quantity: number }[]; note: string; version: number; revision: number; file_name: string; reviewer: string; reviewed_at: string | null };
export type PharmacyOrderRecord = { id: number; version: number; reservation: string; data: import('../domain/orders').DemoOrder; rider: null | { id: string; name: string; status: string } };
export type PharmacyActivity = { id: number; action: string; target: string; note: string; actor: string; created_at: string };
export type PublicCatalog = { medicines: import('../data/catalog').Medicine[]; pharmacies: import('../data/catalog').Pharmacy[]; offers: import('../data/catalog').Offer[] };
export type UploadFile = { uri: string; name: string; mimeType: string };
async function appendUpload(body: FormData, key: string, file: UploadFile) {
  if (Platform.OS === 'web') body.append(key, await (await fetch(file.uri)).blob(), file.name);
  else body.append(key, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
}
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

function developmentApiUrl() {
  // A physical phone must use the Metro computer's LAN address, not loopback.
  if (__DEV__ && Platform.OS !== 'web' && Constants.expoConfig?.hostUri) {
    try {
      const host = new URL(`http://${Constants.expoConfig.hostUri}`).hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:8000`;
    } catch { /* Fall back when no usable development host is available. */ }
  }
  return 'http://127.0.0.1:8000';
}
const apiBase = (process.env.EXPO_PUBLIC_API_URL || developmentApiUrl()).replace(/\/$/, '');
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

async function request<T>(path: string, init: RequestInit = {}, retry = true, responseType: 'json' | 'blob' = 'json'): Promise<T> {
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
      return request<T>(path, init, false, responseType);
    }
    await clearSession();
  }
  if (!response.ok) {
    let body: unknown = null;
    try { body = await response.json(); } catch { /* response has no JSON body */ }
    throw new ApiError(detailMessage(body), response.status);
  }
  if (response.status === 204) return undefined as T;
  if (responseType === 'blob') return response.blob() as Promise<T>;
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
  publicCatalog: () => request<PublicCatalog>('/api/catalog/'),
  pharmacyMe: () => request<PharmacySession>('/api/pharmacy/me/'),
  pharmacyApplication: (payload: Record<string, string>, update = false) => request<PharmacyApplication>('/api/pharmacy/me/', { method: update ? 'PATCH' : 'POST', body: JSON.stringify(payload) }),
  pharmacyDocument: (id: number) => request<Blob>(`/api/pharmacy/documents/${id}/`, {}, true, 'blob'),
  pharmacySubmitApplication: () => request<PharmacyApplication>('/api/pharmacy/application/submit/', { method: 'POST', body: '{}' }),
  pharmacyUploadDocument: async (kind: string, file: UploadFile) => { const body = new FormData(); body.append('kind', kind); await appendUpload(body, 'file', file); return request<PharmacyApplication>('/api/pharmacy/documents/', { method: 'POST', body }); },
  pharmacySetOpen: (is_open: boolean) => request<PharmacyApplication>('/api/pharmacy/open/', { method: 'POST', body: JSON.stringify({ is_open }) }),
  pharmacyMedicines: () => request<PharmacyMedicine[]>('/api/pharmacy/medicines/'),
  pharmacyMedicineRequest: (payload: Record<string, unknown>) => request<AdminMedicine>('/api/pharmacy/medicines/', { method: 'POST', body: JSON.stringify(payload) }),
  pharmacyInventory: (id: string, payload: Record<string, unknown>) => request(`/api/pharmacy/inventory/${encodeURIComponent(id)}/`, { method: 'POST', body: JSON.stringify(payload) }),
  pharmacyPrescriptions: () => request<PharmacyPrescription[]>('/api/pharmacy/prescriptions/'),
  pharmacyPrescriptionReview: (id: number, payload: Record<string, unknown>) => request(`/api/pharmacy/prescriptions/${id}/review/`, { method: 'POST', body: JSON.stringify(payload) }),
  pharmacyPrescriptionFile: (id: number) => request<Blob>(`/api/pharmacy/prescriptions/${id}/file/`, {}, true, 'blob'),
  pharmacyOrders: () => request<PharmacyOrderRecord[]>('/api/pharmacy/orders/'),
  pharmacyOrderAction: (id: number, payload: Record<string, unknown>) => request<PharmacyOrderRecord>(`/api/pharmacy/orders/${id}/action/`, { method: 'POST', body: JSON.stringify(payload) }),
  pharmacyRiders: () => request<{ id: number; name: string; vehicle: string }[]>('/api/pharmacy/riders/'),
  pharmacyHandoff: (id: number, version: number, rider_id: number) => request<PharmacyOrderRecord>(`/api/pharmacy/orders/${id}/handoff/`, { method: 'POST', body: JSON.stringify({ version, rider_id }) }),
  pharmacyTeam: () => request<{ id: number; name: string; email: string; role: string; verified_pharmacist: boolean; active: boolean }[]>('/api/pharmacy/team/'),
  pharmacyActivity: () => request<PharmacyActivity[]>('/api/pharmacy/activity/'),
  customerPrescriptionFile: (url: string) => { const path = new URL(url).pathname; if (!/^\/api\/customer\/prescriptions\/\d+\/file\/$/.test(path)) throw new ApiError('Invalid prescription file.'); return request<Blob>(path, {}, true, 'blob'); },
  adminPharmacies: () => request<AdminPharmacy[]>('/api/administration/pharmacies/'),
  adminMedicines: () => request<AdminMedicine[]>('/api/administration/medicines/'),
  adminReviewPharmacy: (id: string, payload: { status: AdminPharmacy['status']; notes: string; version: number }) => request<AdminPharmacy>(`/api/administration/pharmacies/${encodeURIComponent(id)}/review/`, { method: 'POST', body: JSON.stringify(payload) }),
  adminSetPharmacyLocation: (id: string, payload: { latitude: number; longitude: number }) => request<AdminPharmacy>(`/api/administration/pharmacies/${encodeURIComponent(id)}/location/`, { method: 'POST', body: JSON.stringify(payload) }),
  adminReviewMedicine: (id: string, payload: { status: AdminMedicine['status']; notes: string; version: number }) => request<AdminMedicine>(`/api/administration/medicines/${encodeURIComponent(id)}/review/`, { method: 'POST', body: JSON.stringify(payload) }),
  adminCreateMedicine: (payload: { name: string; description: string; generic: string; strength: string; form: string; unit: string; prescription: boolean; pharmacy_id: string }) => request<AdminMedicine>('/api/administration/medicines/', { method: 'POST', body: JSON.stringify(payload) }),
  adminDocument: (id: number) => request<Blob>(`/api/administration/documents/${id}/`, {}, true, 'blob'),
  register: (payload: { email: string; password: string; full_name: string; phone: string }) => request<ApiSession>('/api/auth/register/', { method: 'POST', body: JSON.stringify(payload) }, false),
  login: (payload: { email: string; password: string }) => request<ApiSession>('/api/auth/token/', { method: 'POST', body: JSON.stringify(payload) }, false),
  riderLogin: (payload: { email: string; password: string }) => request<{ rider: Rider; access: string; refresh: string }>('/api/rider/token/', { method: 'POST', body: JSON.stringify(payload) }, false),
  riderMe: () => request<Rider>('/api/rider/me/'),
  riderSetAvailability: (available: boolean) => request<Rider>('/api/rider/me/', { method: 'PATCH', body: JSON.stringify({ available }) }),
  riderDeliveries: (bucket = 'all') => request<RiderDelivery[]>(`/api/rider/deliveries/${bucket === 'all' ? '' : `?bucket=${bucket}`}`),
  riderAction: async (id: string, payload: Record<string, string | boolean>, proof?: { uri: string; name: string; mimeType: string }) => {
    if (!proof) return request<RiderDelivery>(`/api/rider/deliveries/${encodeURIComponent(id)}/action/`, { method: 'POST', body: JSON.stringify(payload) });
    const body = new FormData();
    for (const [key, value] of Object.entries(payload)) body.append(key, String(value));
    await appendUpload(body, 'proof', proof);
    return request<RiderDelivery>(`/api/rider/deliveries/${encodeURIComponent(id)}/action/`, { method: 'POST', body });
  },
  riderReportIssue: async (id: string, payload: { reason: string; details: string }, photo?: { uri: string; name: string; mimeType: string }) => {
    if (!photo) return request<{ issue: { id: number; reason: string; details: string }; delivery: RiderDelivery }>(`/api/rider/deliveries/${encodeURIComponent(id)}/issues/`, { method: 'POST', body: JSON.stringify(payload) });
    const body = new FormData();
    body.append('reason', payload.reason);
    body.append('details', payload.details);
    await appendUpload(body, 'photo', photo);
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
  saveOrder: <T>(external_id: string, data: T) => request<{ external_id: string; data: T }>('/api/customer/orders/', { method: 'POST', body: JSON.stringify({ external_id, data }) }),
  listPrescriptions: <T>() => request<{ results?: T[] } | T[]>('/api/customer/prescriptions/'),
  savePrescription: async <T,>(external_id: string, data: T, file?: { uri: string; name: string; mimeType: string }) => {
    const body = new FormData();
    body.append('external_id', external_id);
    body.append('data', JSON.stringify(data));
    if (file) await appendUpload(body, 'file', file);
    return request('/api/customer/prescriptions/', { method: 'POST', body });
  },
};
