const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'https://api-production-240da.up.railway.app/api';

export type StudentProfile = {
  studentCode: string;
  fullName: string;
  schoolName: string;
  className: string;
  status: string;
};

export type StudentActivity = {
  id: string;
  type: string;
  label: string;
  amountRwf: number;
  when: string;
  canteenName: string | null;
  description: string | null;
};

export type StudentLookup = StudentProfile & { hasAccount: boolean };

const TOKEN_KEY = 'ekofi_student_token';

export function studentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveStudentToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearStudentToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const auth = token ?? studentToken();
  if (auth) headers.set('Authorization', `Bearer ${auth}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Something went wrong. Try again.';
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : message);
  }
  return data as T;
}

export function lookupStudent(studentCode: string) {
  return request<StudentLookup>('/student-portal/lookup', {
    method: 'POST',
    body: JSON.stringify({ studentCode }),
  });
}

export function registerStudent(studentCode: string, password: string) {
  return request<{
    accessToken: string;
    student: StudentProfile;
    wallet: { balanceRwf: number };
  }>('/student-portal/register', {
    method: 'POST',
    body: JSON.stringify({ studentCode, password }),
  });
}

export function loginStudent(studentCode: string, password: string) {
  return request<{
    accessToken: string;
    student: StudentProfile;
    wallet: { balanceRwf: number };
  }>('/student-portal/login', {
    method: 'POST',
    body: JSON.stringify({ studentCode, password }),
  });
}

export function fetchStudentWallet() {
  return request<{
    student: StudentProfile;
    balanceRwf: number;
    activity: StudentActivity[];
  }>('/student-portal/wallet');
}

export { rwf, whenLabel } from '@/lib/parent-api';
