'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, PageHeader } from '@/components/Ui';
import { api, downloadApiFile, money } from '@/lib/api';
import { LedgerEvent } from '@/lib/types';

export default function TransactionsPage() {
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPaid() {
    setDownloading(true);
    try {
      const day = new Date().toISOString().slice(0, 10);
      await downloadApiFile('/transactions/export', `ekofi-paid-meals-${day}.csv`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download paid meals');
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    api<LedgerEvent[]>('/transactions')
      .then(setEvents)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Shell>
      <PageHeader
        title="Transaction history"
        subtitle="Download paid canteen meals as a spreadsheet. Posted entries cannot be edited or deleted."
        action={
          <Button variant="secondary" onClick={downloadPaid} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download paid meals'}
          </Button>
        }
      />
      {error ? <p className="text-red-700">{error}</p> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-stone-500">
                <th className="py-2">Type</th>
                <th>Student</th>
                <th>Canteen</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-stone-100">
                  <td className="py-2">
                    <Link className="underline" href={`/transactions/${event.id}`}>
                      {event.type}
                    </Link>
                  </td>
                  <td>
                    {event.student
                      ? `${event.student.studentCode} ${event.student.lastName}`
                      : '—'}
                  </td>
                  <td>{event.canteen?.name ?? '—'}</td>
                  <td>{money(event.amountRwf)}</td>
                  <td>
                    <Badge tone={event.status === 'POSTED' ? 'good' : 'neutral'}>{event.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}
