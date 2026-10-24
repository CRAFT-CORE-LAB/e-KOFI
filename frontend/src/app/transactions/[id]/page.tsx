'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, ErrorText, PageHeader } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { LedgerEvent } from '@/lib/types';

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<LedgerEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api<LedgerEvent>(`/transactions/${id}`);
    setEvent(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  async function reverse(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSaving(true);
    try {
      await api(`/purchases/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reversal failed');
    } finally {
      setSaving(false);
    }
  }

  if (!event) {
    return (
      <Shell>
        <p>{error ?? 'Loading transaction…'}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader title={event.type} subtitle={event.id} />
      <Card className="mb-4">
        <p>
          <Badge tone={event.status === 'POSTED' ? 'good' : 'neutral'}>{event.status}</Badge>
          <span className="ml-2">{money(event.amountRwf)}</span>
        </p>
        <p className="mt-2 text-sm text-stone-600">{event.description}</p>
        {event.status === 'POSTED' && event.type !== 'REVERSAL' ? (
          <form className="mt-4" onSubmit={reverse}>
            <Button type="submit" variant="danger" disabled={saving}>
              {saving ? 'Reversing…' : 'Post reversal'}
            </Button>
          </form>
        ) : null}
        <ErrorText message={error} />
      </Card>
      <Card>
        <h3 className="mb-3 font-medium">Ledger entries</h3>
        <ul className="text-sm">
          {event.entries.map((entry) => (
            <li key={entry.id} className="flex justify-between py-1">
              <span>
                {entry.side} {entry.accountType}
              </span>
              <span>{money(entry.amountRwf)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}
