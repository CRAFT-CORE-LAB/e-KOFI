'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, downloadApiFile, money } from '@/lib/api';
import { Canteen } from '@/lib/types';

export default function CanteenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const data = new FormData(form);
    const amountRwf = Number(data.get('amount'));
    const mobilePhone = String(data.get('phone') ?? '');
    setSending(true);
    setNotice(null);
    try {
      await api(`/canteens/${id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({
          amountRwf,
          mobilePhone,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const fresh = await api<Canteen>(`/canteens/${id}`);
      setCanteen(fresh);
      setPayoutError(null);
      setNotice('The payout was sent. The canteen balance is updated.');
      form.reset();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Could not send the payout');
    } finally {
      setSending(false);
    }
  }

  async function downloadPaid() {
    setDownloading(true);
    try {
      const day = new Date().toISOString().slice(0, 10);
      await downloadApiFile(`/transactions/export?canteenId=${encodeURIComponent(id)}`, `ekofi-paid-meals-${day}.csv`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download paid meals');
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    api<Canteen>(`/canteens/${id}`)
      .then(setCanteen)
      .catch((err) => setError(err.message));
  }, [id]);

  if (!canteen) {
    return (
      <Shell>
        <p>{error ?? 'Loading canteen…'}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={canteen.name}
        subtitle={`${canteen.school.name} · ${money(canteen.account?.balanceRwf ?? 0)}`}
      />
      <Card className="mb-6">
        <h3 className="mb-1 font-medium">Send earnings to mobile money</h3>
        <p className="mb-4 text-sm text-stone-600">
          MTN or Airtel. The amount leaves this canteen balance when Intouch accepts the payout.
        </p>
        <Form onSubmit={withdraw}>
          <Field label="Amount (RWF)">
            <input className={inputClass} name="amount" inputMode="numeric" min={100} required />
          </Field>
          <Field label="Mobile money number">
            <input className={inputClass} name="phone" placeholder="078… or 073…" required />
          </Field>
          <ErrorText message={payoutError} />
          {notice ? <p className="text-sm text-[#0B1F3A]">{notice}</p> : null}
          <Button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send payout'}
          </Button>
        </Form>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">Transaction history</h3>
          <Button variant="secondary" onClick={downloadPaid} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download paid meals'}
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <ul className="divide-y text-sm">
          {(canteen.history ?? []).map((event) => (
            <li key={event.id} className="flex justify-between py-2">
              <span>
                {event.type} · {event.student ? `${event.student.firstName} ${event.student.lastName}` : ''}
              </span>
              <span>{money(event.amountRwf)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}
