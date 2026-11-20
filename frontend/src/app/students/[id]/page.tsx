'use client';

import Link from 'next/link';
import { FormEvent, use, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api, getStoredUser, money } from '@/lib/api';
import { AuthUser, School, Student } from '@/lib/types';

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canLink, setCanLink] = useState(false);
  const [guardians, setGuardians] = useState<{ id: string; phone: string; label: string | null }[]>([]);
  const [topUps, setTopUps] = useState<
    { requestId: string; status: string; channel: string; grossRwf: number; createdAt: string; phone: string }[]
  >([]);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  async function load() {
    const [s, sch] = await Promise.all([api<Student>(`/students/${id}`), api<School[]>('/schools')]);
    setStudent(s);
    setSchools(sch);
  }

  async function loadParents() {
    const [linked, payments] = await Promise.all([
      api<{ id: string; phone: string; label: string | null }[]>(`/students/${id}/guardians`),
      api<{ requestId: string; status: string; channel: string; grossRwf: number; createdAt: string; phone: string }[]>(
        `/students/${id}/top-ups`,
      ),
    ]);
    setGuardians(linked);
    setTopUps(payments);
  }

  useEffect(() => {
    const role = getStoredUser<AuthUser>()?.role;
    const allowed = role === 'ADMIN' || role === 'SUPERADMIN';
    setCanLink(allowed);
    load().catch((err) => setError(err.message));
    if (allowed) {
      loadParents().catch((err) => setError(err.message));
    }
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
      {canLink ? (
        <Card className="mt-6">
          <h3 className="mb-1 font-medium">WhatsApp top-up phones</h3>
          <p className="mb-4 text-sm text-stone-600">
            Only a linked WhatsApp number can see this student or add money. A link code lets a parent attach their own number once.
          </p>
          <ul className="mb-4 divide-y text-sm">
            {guardians.map((guardian) => (
              <li key={guardian.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {guardian.phone}
                  {guardian.label ? <span className="block text-stone-500">{guardian.label}</span> : null}
                </span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    api(`/students/${id}/guardians/${guardian.id}`, { method: 'DELETE' })
                      .then(() => loadParents())
                      .catch((err) => setError(err.message))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
            {guardians.length === 0 ? <li className="py-2 text-stone-500">No parent phone linked yet.</li> : null}
          </ul>
          <Form
            onSubmit={(event) => {
              const form = event.currentTarget;
              const data = new FormData(form);
              api(`/students/${id}/guardians`, {
                method: 'POST',
                body: JSON.stringify({
                  phone: data.get('phone'),
                  label: data.get('label') || undefined,
                }),
              })
                .then(() => {
                  form.reset();
                  return loadParents();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Could not link the phone'));
            }}
          >
            <Field label="Parent WhatsApp number">
              <input className={inputClass} name="phone" placeholder="078… or 2507…" required />
            </Field>
            <Field label="Label (optional)">
              <input className={inputClass} name="label" placeholder="Mother" />
            </Field>
            <Button type="submit">Link phone</Button>
          </Form>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={() =>
                api<{ code: string }>(`/students/${id}/guardian-link-code`, { method: 'POST' })
                  .then((result) => setLinkCode(result.code))
                  .catch((err) => setError(err instanceof Error ? err.message : 'Could not create a link code'))
              }
            >
              Create a 24-hour link code
            </Button>
            {linkCode ? (
              <p className="mt-2 text-sm">
                Give the parent this code: <strong>{linkCode}</strong>. It works once and is not shown again.
              </p>
            ) : null}
          </div>
          <h3 className="mb-2 mt-6 font-medium">Recent wallet top-ups</h3>
          <ul className="divide-y text-sm">
            {topUps.map((row) => (
              <li key={row.requestId} className="flex justify-between gap-3 py-2">
                <span>
                  {row.channel === 'WHATSAPP' ? 'WhatsApp' : row.channel === 'ADMIN_MANUAL' ? 'Admin' : 'Parent portal'}
                  <span className="block text-stone-500">
                    {row.requestId} · {row.phone} · {row.status}
                  </span>
                </span>
                <span>{money(row.grossRwf)}</span>
              </li>
            ))}
            {topUps.length === 0 ? <li className="py-2 text-stone-500">No mobile-money top-ups yet.</li> : null}
          </ul>
        </Card>
      ) : null}
    </Shell>
  );
}
