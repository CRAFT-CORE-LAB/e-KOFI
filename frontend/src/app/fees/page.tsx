'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';

type FeeRow = {
  id: string;
  feeRwf: number;
  grossRwf: number;
  studentCode: string;
  studentName: string;
  when: string;
};

type WithdrawalRow = {
  id: string;
  amountRwf: number;
  description: string | null;
  when: string;
};

type PlatformWallet = {
  balanceRwf: number;
  fees: FeeRow[];
  withdrawals: WithdrawalRow[];
};

export default function FeesPage() {
  const [wallet, setWallet] = useState<PlatformWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const data = await api<PlatformWallet>('/platform/wallet');
    setWallet(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load fees'));
  }, []);

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const amountRwf = Number(data.get('amount'));
    const mobilePhone = String(data.get('phone') ?? '');
    setSending(true);
    setNotice(null);
    try {
      await api('/platform/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amountRwf,
          mobilePhone,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await load();
      setError(null);
      setNotice('The service-fee payout was sent.');
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the payout');
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Service fees"
        subtitle={wallet ? money(wallet.balanceRwf) : 'Loading the fee balance…'}
      />
      <Card className="mb-6">
        <h3 className="mb-1 font-medium">Send fees to mobile money</h3>
        <p className="mb-4 text-sm text-stone-600">
          This pays out the 3% service fee collected on wallet top-ups. Only the e-KOFI owner can send it.
        </p>
        <Form onSubmit={withdraw}>
          <Field label="Amount (RWF)">
            <input className={inputClass} name="amount" inputMode="numeric" min={100} required />
          </Field>
          <Field label="Mobile money number">
            <input className={inputClass} name="phone" placeholder="078… or 073…" required />
          </Field>
          <ErrorText message={error} />
          {notice ? <p className="text-sm text-[#0B1F3A]">{notice}</p> : null}
          <Button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send payout'}
          </Button>
        </Form>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium">Recent fees</h3>
          <ul className="divide-y text-sm">
            {(wallet?.fees ?? []).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>
                  {row.studentName}
                  <span className="block text-stone-500">{row.studentCode}</span>
                </span>
                <span>{money(row.feeRwf)}</span>
              </li>
            ))}
            {wallet && wallet.fees.length === 0 ? <li className="py-2 text-stone-500">No fees yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-medium">Payouts</h3>
          <ul className="divide-y text-sm">
            {(wallet?.withdrawals ?? []).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>{row.description || 'Payout'}</span>
                <span>{money(row.amountRwf)}</span>
              </li>
            ))}
            {wallet && wallet.withdrawals.length === 0 ? (
              <li className="py-2 text-stone-500">No payouts yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </Shell>
  );
}
