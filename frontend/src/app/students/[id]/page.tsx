'use client';

import Link from 'next/link';
import { FormEvent, use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { School, Student } from '@/lib/types';

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [s, sch] = await Promise.all([api<Student>(`/students/${id}`), api<School[]>('/schools')]);
    setStudent(s);
    setSchools(sch);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    if (!student) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const pin = String(form.get('pin') ?? '');
      const updated = await api<Student>(`/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          schoolId: form.get('schoolId'),
          classId: form.get('classId'),
          pinEnabled: form.get('pinEnabled') === 'on',
          pin: pin || undefined,
        }),
      });
      setStudent(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    try {
      const updated = await api<Student>(`/students/${id}/deactivate`, { method: 'POST' });
      setStudent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deactivate failed');
    }
  }

  if (!student) {
    return (
      <Shell>
        <p>{error ?? 'Loading student…'}</p>
      </Shell>
    );
  }

  const school = schools.find((item) => item.id === student.school.id) ?? schools[0];

  return (
    <Shell>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={student.studentCode}
        action={
          <div className="flex gap-2">
            <Link href={`/wallets/${student.id}`}>
              <Button variant="secondary">Wallet</Button>
            </Link>
            {student.status === 'ACTIVE' ? (
              <Button variant="danger" onClick={deactivate}>
                Deactivate
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4">
        <Badge tone={student.status === 'ACTIVE' ? 'good' : 'bad'}>{student.status}</Badge>
        <span className="ml-2 text-sm text-stone-600">
          Wallet: {student.wallet ? money(student.wallet.balanceRwf) : '—'}
        </span>
      </div>
      <Card>
        <Form onSubmit={onSave}>
          <Field label="First name">
            <input className={inputClass} name="firstName" defaultValue={student.firstName} required />
          </Field>
          <Field label="Last name">
            <input className={inputClass} name="lastName" defaultValue={student.lastName} required />
          </Field>
          <Field label="School">
            <select className={inputClass} name="schoolId" defaultValue={student.school.id}>
              {schools.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select className={inputClass} name="classId" defaultValue={student.class.id}>
              {(school?.classes ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pinEnabled" defaultChecked={student.pinEnabled} />
            PIN authorization enabled
          </label>
          <Field label="Replace PIN (optional)">
            <input className={inputClass} name="pin" pattern="\d{4,6}" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Form>
      </Card>
    </Shell>
  );
}
