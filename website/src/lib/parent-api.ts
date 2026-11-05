const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'https://api-production-240da.up.railway.app/api';

export type ParentStudent = {
  studentCode: string;
  fullName: string;
  schoolName: string;
  className: string;
  status: string;
};

export type ParentActivity = {
  id: string;
  type: string;
  label: string;
  amountRwf: number;
  when: string;
  canteenName: string | null;
  description: string | null;
};

const TOKEN_KEY = 'ekofi_parent_token';

export function parentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveParentToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearParentToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const auth = token ?? parentToken();
  if (auth) headers.set('Authorization', `Bearer ${auth}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Something went wrong. Try again.';
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : message);
  }
  return data as T;
}

export function openParentSession(studentCode: string) {
  return request<{
    accessToken: string;
    student: ParentStudent;
    wallet: { balanceRwf: number };
  }>('/parents/session', {
    method: 'POST',
    body: JSON.stringify({ studentCode }),
  });
}

export function fetchParentWallet() {
  return request<{
    student: ParentStudent;
    balanceRwf: number;
    activity: ParentActivity[];
  }>('/parents/wallet');
}

export type TopUpState = {
  status: 'PENDING' | 'POSTED' | 'FAILED';
  requestId: string;
  message: string;
  grossRwf: number;
  feeRwf: number;
  studentCreditRwf: number;
  balanceRwf?: number;
};

export function topUpWallet(amountRwf: number, mobilePhone: string, idempotencyKey: string) {
  return request<TopUpState>('/parents/top-up', {
    method: 'POST',
    body: JSON.stringify({ amountRwf, mobilePhone, idempotencyKey }),
  });
}

export function topUpStatus(requestId: string) {
  return request<TopUpState>(`/parents/top-up/${encodeURIComponent(requestId)}`);
}

export function rwf(amount: number) {
  return `${amount.toLocaleString('en-RW')} RWF`;
}

export function whenLabel(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('en-RW', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
