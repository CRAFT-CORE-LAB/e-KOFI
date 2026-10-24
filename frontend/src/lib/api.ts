const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ekofi_token');
}

export function setSession(token: string, user: unknown) {
  localStorage.setItem('ekofi_token', token);
  localStorage.setItem('ekofi_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('ekofi_token');
  localStorage.removeItem('ekofi_user');
}

export function getStoredUser<T>() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ekofi_user');
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${API_URL}. Start PostgreSQL and the backend (port 3001), then try again.`,
    );
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message =
      data?.message?.toString?.() ??
      (Array.isArray(data?.message) ? data.message.join(', ') : null) ??
      response.statusText;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export const money = (amount: number) =>
  `${amount.toLocaleString('en-RW')} RWF`;
