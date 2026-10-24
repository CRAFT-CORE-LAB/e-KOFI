'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '@/lib/api';
import { AuthUser } from '@/lib/types';
import { Button, ErrorText, Field, inputClass } from '@/components/Ui';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ accessToken: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      setSession(result.accessToken, result.user);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1F3A] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-sm">
        <img src="/ekofi-logo.jpg" alt="e-KOFI" className="h-12 w-auto" />
        <h1 className="mt-5 text-2xl font-semibold text-[#0B1F3A]">Sign in</h1>
        <p className="mt-2 text-sm text-[#0B1F3A]/70">Safe money. Fast payments. Made for students.</p>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field label="Email">
            <input className={inputClass} name="email" type="email" defaultValue="admin@ekofi.local" required />
          </Field>
          <Field label="Password">
            <input className={inputClass} name="password" type="password" defaultValue="Admin123!" required />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
