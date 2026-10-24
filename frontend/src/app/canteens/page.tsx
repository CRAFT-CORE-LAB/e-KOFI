'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { Canteen, School } from '@/lib/types';

export default function CanteensPage() {
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [c, s] = await Promise.all([api<Canteen[]>('/canteens'), api<School[]>('/schools')]);
    setCanteens(c);
    setSchools(s);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await api('/canteens', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          schoolId: form.get('schoolId'),
        }),
      });
      await load();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register canteen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <PageHeader title="Canteens" subtitle="Internal earnings accounts. Withdrawals are not part of Phase 1." />
      <Card className="mb-6">
        <Form onSubmit={create}>
          <Field label="Name">
            <input className={inputClass} name="name" required />
          </Field>
          <Field label="School">
            <select className={inputClass} name="schoolId">
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Register canteen'}
          </Button>
        </Form>
      </Card>
      <Card>
        <ul className="divide-y text-sm">
          {canteens.map((canteen) => (
            <li key={canteen.id} className="flex justify-between py-3">
              <Link className="text-[#14B8A6] underline" href={`/canteens/${canteen.id}`}>
                {canteen.name}
              </Link>
              <span>{canteen.account ? money(canteen.account.balanceRwf) : '0 RWF'}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}
