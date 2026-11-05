'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { Canteen, Student } from '@/lib/types';

type PurchaseResult = {
  event: { id: string; amountRwf: number; type: string };
  wallet?: { balanceRwf: number };
  duplicate?: boolean;
};

export default function PurchasePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api<Student[]>('/students?status=ACTIVE'), api<Canteen[]>('/canteens')])
      .then(([s, c]) => {
        setStudents(s);
        setCanteens(c);
        if (s[0]) setStudentId(s[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const selected = students.find((s) => s.id === studentId);

  async function purchase(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        amountRwf: Number(form.get('amountRwf')),
        canteenId: form.get('canteenId'),
        studentId,
        pin: form.get('pin') || undefined,
        description: form.get('description') || 'Canteen meal',
        identifiedBy: 'FINGERPRINT',
        idempotencyKey: crypto.randomUUID(),
      };
      const posted = await api<PurchaseResult>('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(posted);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Process purchase"
        subtitle="For manual charges in the browser. At the canteen, staff use the mobile app and the student’s fingerprint."
      />
      <Card className="max-w-xl">
        <Form onSubmit={purchase}>
          <Field label="Student">
            <select className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentCode} · {student.lastName} {student.firstName}
                </option>
              ))}
            </select>
          </Field>
          {selected ? (
            <p className="text-sm text-stone-600">
              Balance {selected.wallet ? money(selected.wallet.balanceRwf) : '—'}
              {selected.pinEnabled ? ' · PIN required' : ''}
            </p>
          ) : null}
          <Field label="Canteen">
            <select className={inputClass} name="canteenId" required>
              {canteens.map((canteen) => (
                <option key={canteen.id} value={canteen.id}>
                  {canteen.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (RWF)">
            <input className={inputClass} name="amountRwf" type="number" min={1} required />
          </Field>
          {selected?.pinEnabled ? (
            <Field label="Student PIN">
              <input className={inputClass} name="pin" pattern="\d{4,6}" required />
            </Field>
          ) : null}
          <Field label="Note (optional)">
            <input className={inputClass} name="description" placeholder="Canteen meal" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? 'Posting…' : 'Charge wallet'}
          </Button>
        </Form>
        {result ? (
          <p className="mt-4 rounded-lg bg-[#14B8A6]/15 p-3 text-sm text-[#0B1F3A]">
            {result.duplicate ? 'Duplicate request ignored. ' : ''}
            Posted {result.event.type} {money(result.event.amountRwf)}. Remaining balance{' '}
            {result.wallet ? money(result.wallet.balanceRwf) : 'n/a'}.
          </p>
        ) : null}
      </Card>
    </Shell>
  );
}
