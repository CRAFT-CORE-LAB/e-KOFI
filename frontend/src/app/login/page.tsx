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
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "url('/ekofi-logo.jpg')",
          backgroundRepeat: 'repeat',
          backgroundSize: '180px',
        }}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[#0B1F3A]/10 bg-white p-8 shadow-sm">
        <img src="/ekofi-logo.jpg" alt="e-KOFI" className="h-12 w-auto" />
        <h1 className="mt-5 text-2xl font-semibold text-[#0B1F3A]">Admin portal</h1>
        <p className="mt-2 text-sm text-[#0B1F3A]/70">Sign in to register students. Meal payments are taken in the canteen portal.</p>
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
