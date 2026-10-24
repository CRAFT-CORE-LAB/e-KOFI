'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Card, PageHeader } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { DashboardStats } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardStats>('/dashboard')
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Shell>
      <PageHeader title="Dashboard" subtitle="Student accounts, canteens, and posted ledger activity." />
      {error ? <p className="text-red-700">{error}</p> : null}
      {!stats ? (
        <p className="text-sm text-stone-500">Loading counts…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Students" value={String(stats.students)} hint={`${stats.activeStudents} active`} />
            <Stat label="Canteens" value={String(stats.canteens)} />
            <Stat label="Active NFC cards" value={String(stats.activeCards)} />
            <Stat label="Posted purchases" value={String(stats.postedPurchases)} />
            <Stat label="Purchase volume" value={money(stats.purchaseVolumeRwf)} />
          </div>
          <Card className="mt-6">
            <h3 className="mb-3 font-medium">Recent transactions</h3>
            <ul className="divide-y divide-stone-100 text-sm">
              {stats.recent.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {event.type} · {event.student ? `${event.student.firstName} ${event.student.lastName}` : '—'}
                  </span>
                  <span className="text-stone-600">{money(event.amountRwf)}</span>
                </li>
              ))}
              {stats.recent.length === 0 ? <li className="py-2 text-stone-500">No transactions yet.</li> : null}
            </ul>
          </Card>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </Card>
  );
}
