'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearStudentToken,
  fetchStudentWallet,
  loginStudent,
  lookupStudent,
  registerStudent,
  rwf,
  saveStudentToken,
  StudentActivity,
  StudentProfile,
  studentToken,
  whenLabel,
} from '@/lib/student-api';

type Step = 'start' | 'register' | 'login' | 'home';

const inputClass =
  'h-16 rounded-2xl border-2 border-navy/15 px-5 text-xl outline-none focus:border-teal';
const btnPrimary =
  'h-16 rounded-full bg-navy text-xl font-semibold text-white hover:bg-[#16345c] disabled:opacity-60';

export function StudentPortal() {
  const [step, setStep] = useState<Step>('start');
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [preview, setPreview] = useState<(StudentProfile & { hasAccount: boolean }) | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [balance, setBalance] = useState(0);
  const [activity, setActivity] = useState<StudentActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const credits = useMemo(
    () => activity.filter((row) => row.type === 'PARENT_TOPUP' || row.type === 'TEST_CREDIT' || row.type === 'REVERSAL'),
    [activity],
  );
  const meals = useMemo(() => activity.filter((row) => row.type === 'PURCHASE'), [activity]);

  useEffect(() => {
    const token = studentToken();
    if (!token) return;
    setBusy(true);
    fetchStudentWallet()
      .then((data) => {
        setStudent(data.student);
        setBalance(data.balanceRwf);
        setActivity(data.activity);
        setStep('home');
      })
      .catch(() => clearStudentToken())
      .finally(() => setBusy(false));
  }, []);

  async function onLookup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await lookupStudent(studentCode);
      setPreview(data);
      setStep(data.hasAccount ? 'login' : 'register');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that Student ID.');
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== passwordAgain) {
      setError('Passwords do not match. Type the same password twice.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await registerStudent(studentCode, password);
      saveStudentToken(data.accessToken);
      setStudent(data.student);
      setBalance(data.wallet.balanceRwf);
      const wallet = await fetchStudentWallet();
      setActivity(wallet.activity);
      setStep('home');
      setMessage('Your account is ready. Here is your wallet.');
      setPassword('');
      setPasswordAgain('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await loginStudent(studentCode, password);
      saveStudentToken(data.accessToken);
      setStudent(data.student);
      setBalance(data.wallet.balanceRwf);
      const wallet = await fetchStudentWallet();
      setActivity(wallet.activity);
      setStep('home');
      setMessage(`Welcome back, ${data.student.fullName.split(' ')[0]}.`);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in did not work. Check your password.');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearStudentToken();
    setStep('start');
    setStudent(null);
    setPreview(null);
    setStudentCode('');
    setPassword('');
    setPasswordAgain('');
    setMessage(null);
    setError(null);
  }

  function backToStart() {
    setStep('start');
    setPreview(null);
    setPassword('');
    setPasswordAgain('');
    setError(null);
    setMessage(null);
  }

  if (step === 'start') {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-3xl border border-navy/10 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-pine">Student wallet</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">Check your lunch money</h1>
          <p className="mt-4 text-lg leading-8 text-navy/80">
            Enter your <strong>Student ID</strong> from school. First time here? You will choose a password. Already
            registered? You will sign in.
          </p>
          <form className="mt-8 grid gap-5" onSubmit={onLookup}>
            <label className="grid gap-2">
              <span className="text-lg font-semibold">Student ID</span>
              <input
                className={`${inputClass} uppercase tracking-wide`}
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="Example: STU-000005"
                autoComplete="username"
                required
              />
            </label>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-lg text-red-800">{error}</p> : null}
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'One moment…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'register' && preview) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-3xl border border-navy/10 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-pine">Create your account</p>
          <h1 className="mt-2 text-3xl font-bold">{preview.fullName}</h1>
          <p className="mt-3 text-lg text-navy/80">
            <strong>{preview.schoolName}</strong> · Class <strong>{preview.className}</strong>
          </p>
          <p className="mt-2 text-base text-navy/70">ID {preview.studentCode}</p>
          <p className="mt-6 text-lg leading-8 text-navy/80">
            Choose a password you will remember. You need it each time you open this page.
          </p>
          <form className="mt-6 grid gap-5" onSubmit={onRegister}>
            <label className="grid gap-2">
              <span className="text-lg font-semibold">New password</span>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-lg font-semibold">Type password again</span>
              <input
                type="password"
                className={inputClass}
                value={passwordAgain}
                onChange={(e) => setPasswordAgain(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-lg text-red-800">{error}</p> : null}
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Saving…' : 'Create account & see wallet'}
            </button>
            <button type="button" onClick={backToStart} className="text-lg font-semibold text-navy/70 underline">
              Use a different Student ID
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'login' && preview) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-3xl border border-navy/10 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-pine">Sign in</p>
          <h1 className="mt-2 text-3xl font-bold">{preview.fullName}</h1>
          <p className="mt-3 text-lg text-navy/80">
            {preview.schoolName} · {preview.className}
          </p>
          <form className="mt-8 grid gap-5" onSubmit={onLogin}>
            <label className="grid gap-2">
              <span className="text-lg font-semibold">Password</span>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-lg text-red-800">{error}</p> : null}
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Signing in…' : 'See my wallet'}
            </button>
            <button type="button" onClick={backToStart} className="text-lg font-semibold text-navy/70 underline">
              Use a different Student ID
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-pine">My wallet</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{student?.fullName}</h1>
          <p className="mt-2 text-lg text-navy/75">
            {student?.schoolName} · Class {student?.className}
          </p>
          <p className="mt-1 text-base text-navy/65">
            Student ID <span className="font-semibold">{student?.studentCode}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="h-12 rounded-full border-2 border-navy/15 px-5 text-base font-semibold"
        >
          Sign out
        </button>
      </div>

      {message ? (
        <p className="mt-6 rounded-2xl bg-teal/15 px-5 py-4 text-lg font-medium text-navy">{message}</p>
      ) : null}

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <p className="text-lg text-navy/70">Money for meals</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-navy">{rwf(balance)}</p>
      </section>

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <h2 className="text-2xl font-bold">Money added</h2>
        {credits.length === 0 ? (
          <p className="mt-3 text-lg text-navy/70">When parents or the school add money, it shows here.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {credits.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-4">
                <div>
                  <p className="text-lg font-semibold">{row.label}</p>
                  <p className="text-base text-navy/70">{whenLabel(row.when)}</p>
                </div>
                <p className="text-xl font-bold text-pine">+{rwf(row.amountRwf)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <h2 className="text-2xl font-bold">Meals you paid</h2>
        {meals.length === 0 ? (
          <p className="mt-3 text-lg text-navy/70">When you pay at the canteen with your finger, meals appear here.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {meals.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-4">
                <div>
                  <p className="text-lg font-semibold">{row.label}</p>
                  <p className="text-base text-navy/70">
                    {whenLabel(row.when)}
                    {row.canteenName ? ` · ${row.canteenName}` : ''}
                  </p>
                </div>
                <p className="text-xl font-bold text-navy">−{rwf(row.amountRwf)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <h2 className="text-2xl font-bold">All activity</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-lg text-navy/70">No transactions yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {activity.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-4">
                <div>
                  <p className="text-lg font-semibold">{row.label}</p>
                  <p className="text-base text-navy/70">
                    {whenLabel(row.when)}
                    {row.canteenName ? ` · ${row.canteenName}` : ''}
                  </p>
                </div>
                <p
                  className={`text-xl font-bold ${
                    row.type === 'PURCHASE' ? 'text-navy' : 'text-pine'
                  }`}
                >
                  {row.type === 'PURCHASE' ? `−${rwf(row.amountRwf)}` : `+${rwf(row.amountRwf)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
