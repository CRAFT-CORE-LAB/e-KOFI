'use client';

import { use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Card, PageHeader } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { Canteen } from '@/lib/types';

export default function CanteenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [canteen, setCanteen] = useState<Canteen | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Card>
        <h3 className="mb-3 font-medium">Transaction history</h3>
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
