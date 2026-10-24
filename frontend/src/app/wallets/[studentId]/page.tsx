'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { LedgerEvent, Student } from '@/lib/types';

type WalletPayload = {
  id: string;
  balanceRwf: number;
  student: Student;
  history: LedgerEvent[];
};

export default function WalletPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<WalletPayload>(`/wallets/student/${studentId}`);
    setWallet(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [studentId]);

  async function credit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api(`/wallets/student/${studentId}/test-credit`, {
        method: 'POST',
        body: JSON.stringify({
          amountRwf: Number(form.get('amountRwf')),
          description: form.get('description') || 'Administrator test credit',
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credit failed');
    } finally {
      setSaving(false);
    }
  }

  if (!wallet) {
    return (
      <Shell>
        <p>{error ?? 'Loading wallet…'}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={`Wallet · ${wallet.student.firstName} ${wallet.student.lastName}`}
        subtitle={`${wallet.student.studentCode} · ${money(wallet.balanceRwf)}`}
      />
      <Card className="mb-6">
        <h3 className="mb-3 font-medium">Development test credit</h3>
        <p className="mb-4 text-sm text-stone-600">
          This posts to the ledger as TEST_CREDIT. It is not a MoMo or bank top-up.
        </p>
        <Form onSubmit={credit}>
          <Field label="Amount (RWF integer)">
            <input className={inputClass} name="amountRwf" type="number" min={1} required />
          </Field>
          <Field label="Description">
            <input className={inputClass} name="description" defaultValue="Administrator test credit" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? 'Posting…' : 'Post test credit'}
          </Button>
        </Form>
      </Card>
      <Card>
        <h3 className="mb-3 font-medium">History</h3>
        <ul className="divide-y text-sm">
          {wallet.history.map((event) => (
            <li key={event.id} className="flex justify-between py-2">
              <span>
                {event.type} · {event.status}
              </span>
              <span>{money(event.amountRwf)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}
