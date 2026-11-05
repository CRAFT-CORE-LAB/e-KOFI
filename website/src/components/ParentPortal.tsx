'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearParentToken,
  fetchParentWallet,
  openParentSession,
  parentToken,
  ParentActivity,
  ParentStudent,
  rwf,
  saveParentToken,
  topUpStatus,
  topUpWallet,
  whenLabel,
} from '@/lib/parent-api';

const amounts = [1000, 2000, 5000, 10000, 20000];

export function ParentPortal() {
  const [step, setStep] = useState<'id' | 'home'>('id');
  const [studentCode, setStudentCode] = useState('');
  const [student, setStudent] = useState<ParentStudent | null>(null);
  const [balance, setBalance] = useState(0);
  const [activity, setActivity] = useState<ParentActivity[]>([]);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topUps = useMemo(
    () => activity.filter((row) => row.type === 'PARENT_TOPUP' || row.type === 'TEST_CREDIT'),
    [activity],
  );

  useEffect(() => {
    const token = parentToken();
    if (!token) return;
    setBusy(true);
    fetchParentWallet()
      .then((data) => {
        setStudent(data.student);
        setBalance(data.balanceRwf);
        setActivity(data.activity);
        setStep('home');
      })
      .catch(() => clearParentToken())
      .finally(() => setBusy(false));
  }, []);

  async function onOpenSession(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await openParentSession(studentCode);
      saveParentToken(data.accessToken);
      setStudent(data.student);
      setBalance(data.wallet.balanceRwf);
      const wallet = await fetchParentWallet();
      setActivity(wallet.activity);
      setStep('home');
      setMessage(`Welcome. Here is ${data.student.fullName}'s wallet.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that Student ID.');
    } finally {
      setBusy(false);
    }
  }

  async function onTopUp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('Approve the message on your phone. This page will update when the payment is finished.');
    try {
      let result = await topUpWallet(amount, phone, crypto.randomUUID());
      const started = Date.now();
      while (result.status === 'PENDING' && Date.now() - started < 120000) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        result = await topUpStatus(result.requestId);
      }
      if (result.status === 'PENDING') {
        setMessage('Still waiting for approval on your phone. You can leave this page and come back.');
        return;
      }
      if (result.status === 'FAILED') {
        setMessage(null);
        setError(result.message || 'The payment was not approved.');
        return;
      }
      if (typeof result.balanceRwf === 'number') setBalance(result.balanceRwf);
      const wallet = await fetchParentWallet();
      setBalance(wallet.balanceRwf);
      setActivity(wallet.activity);
      setMessage(
        `${rwf(result.studentCreditRwf)} is now on ${student?.fullName ?? 'the student'}'s wallet. Service fee ${rwf(result.feeRwf)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up did not finish.');
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearParentToken();
    setStep('id');
    setStudent(null);
    setStudentCode('');
    setMessage(null);
    setError(null);
  }

  if (step === 'id') {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-3xl border border-navy/10 bg-white p-8 shadow-sm">
          <p className="text-lg font-semibold text-pine">Parent wallet</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">Add lunch money for your child</h1>
          <p className="mt-4 text-lg leading-8 text-navy/80">
            No account needed. Enter your child&apos;s <strong>Student ID</strong> from the school. That is enough to
            open the wallet.
          </p>
          <form className="mt-8 grid gap-5" onSubmit={onOpenSession}>
            <label className="grid gap-2">
              <span className="text-lg font-semibold">Student ID</span>
              <input
                className="h-16 rounded-2xl border-2 border-navy/15 px-5 text-xl uppercase tracking-wide outline-none focus:border-teal"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="Example: STU-000005"
                autoComplete="off"
                required
              />
            </label>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-lg text-red-800">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="h-16 rounded-full bg-navy text-xl font-semibold text-white hover:bg-[#16345c] disabled:opacity-60"
            >
              {busy ? 'Looking up…' : 'See my child’s wallet'}
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
          <p className="text-lg font-semibold text-pine">Your child</p>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{student?.fullName}</h1>
          <p className="mt-2 text-lg text-navy/75">
            ID <span className="font-semibold">{student?.studentCode}</span> · {student?.className} ·{' '}
            {student?.schoolName}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="h-12 rounded-full border-2 border-navy/15 px-5 text-base font-semibold"
        >
          Use another ID
        </button>
      </div>

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <p className="text-lg text-navy/70">Money available for meals</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-navy">{rwf(balance)}</p>
      </section>

      {message ? (
        <p className="mt-6 rounded-2xl bg-teal/15 px-5 py-4 text-lg font-medium text-navy">{message}</p>
      ) : null}
      {error ? <p className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-lg text-red-800">{error}</p> : null}

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <h2 className="text-2xl font-bold">Add money</h2>
        <p className="mt-2 text-lg leading-8 text-navy/75">
          Pick an amount, enter your MTN or Airtel number, and approve the payment on your phone.
        </p>
        <form className="mt-6 grid gap-5" onSubmit={onTopUp}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {amounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                className={`h-14 rounded-2xl border-2 text-lg font-semibold ${
                  amount === value ? 'border-teal bg-teal/15 text-navy' : 'border-navy/10 bg-cream text-navy'
                }`}
              >
                {rwf(value)}
              </button>
            ))}
          </div>
          <label className="grid gap-2">
            <span className="text-lg font-semibold">Your mobile money number</span>
            <input
              className="h-16 rounded-2xl border-2 border-navy/15 px-5 text-xl outline-none focus:border-teal"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="078… or 073…"
              inputMode="tel"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-16 rounded-full bg-navy text-xl font-semibold text-white hover:bg-[#16345c] disabled:opacity-60"
          >
            {busy ? 'Waiting for your phone…' : `Add ${rwf(amount)} to wallet`}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-3xl border border-navy/10 bg-white p-8">
        <h2 className="text-2xl font-bold">Money you added</h2>
        {topUps.length === 0 ? (
          <p className="mt-3 text-lg text-navy/70">No top-ups yet. When you add money, it will show here.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {topUps.map((row) => (
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
        <h2 className="text-2xl font-bold">Recent meals and updates</h2>
        {activity.length === 0 ? (
          <p className="mt-3 text-lg text-navy/70">Meals paid by fingerprint will appear here.</p>
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
                    row.type === 'PURCHASE' ? 'text-navy' : row.type === 'REVERSAL' ? 'text-pine' : 'text-pine'
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
