'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api } from '@/lib/api';
import { Card as NfcCard, Student } from '@/lib/types';

export default function CardsPage() {
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [cardRows, studentRows] = await Promise.all([
      api<NfcCard[]>('/cards'),
      api<Student[]>('/students?status=ACTIVE'),
    ]);
    setCards(cardRows);
    setStudents(studentRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function register(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const authToken = String(form.get('authToken') ?? '');
      const result = await api<{ card: NfcCard; authToken: string; message: string }>('/cards/register', {
        method: 'POST',
        body: JSON.stringify({
          studentId: form.get('studentId'),
          cardUid: String(form.get('cardUid')).toUpperCase(),
          authToken: authToken || undefined,
        }),
      });
      setIssuedToken(result.authToken);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  }

  async function block(id: string) {
    try {
      await api(`/cards/${id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Lost or stolen' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Block failed');
    }
  }

  return (
    <Shell>
      <PageHeader
        title="NFC cards"
        subtitle="Register from an Android scan. Payments require the secure token written to the tag, not the UID alone."
      />
      <Card className="mb-6">
        <Form onSubmit={register}>
          <Field label="Student">
            <select className={inputClass} name="studentId" required>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentCode} · {student.lastName} {student.firstName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Card UID (hex, from Android scan)">
            <input className={inputClass} name="cardUid" required placeholder="04A1B2C3D4E5F6" />
          </Field>
          <Field label="Secure auth token (if already on the tag)">
            <input className={inputClass} name="authToken" placeholder="Leave blank to issue a new token" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={saving}>
            {saving ? 'Registering…' : 'Register card'}
          </Button>
        </Form>
        {issuedToken ? (
          <p className="mt-4 break-all rounded-lg bg-amber-50 p-3 text-sm">
            Write this token to the tag NDEF record (Android app): <strong>{issuedToken}</strong>
          </p>
        ) : null}
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-stone-500">
                <th className="py-2">UID</th>
                <th>Student</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-b border-stone-100">
                  <td className="py-2 font-mono">{card.cardUid}</td>
                  <td>
                    {card.student
                      ? `${card.student.studentCode} ${card.student.lastName}`
                      : card.studentId}
                  </td>
                  <td>
                    <Badge tone={card.status === 'ACTIVE' ? 'good' : 'bad'}>{card.status}</Badge>
                  </td>
                  <td>
                    {card.status === 'ACTIVE' ? (
                      <Button variant="danger" onClick={() => block(card.id)}>
                        Block
                      </Button>
                    ) : (
                      <ReplaceForm cardId={card.id} studentId={card.studentId} onDone={load} />
                    )}
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

function ReplaceForm({
  cardId,
  studentId,
  onDone,
}: {
  cardId: string;
  studentId: string;
  onDone: () => Promise<void>;
}) {
  const [uid, setUid] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await api(`/cards/${cardId}/replace`, {
          method: 'POST',
          body: JSON.stringify({ studentId, cardUid: uid.toUpperCase() }),
        });
        await onDone();
      }}
    >
      <input className={inputClass} placeholder="New UID" value={uid} onChange={(e) => setUid(e.target.value)} />
      <Button type="submit" variant="secondary">
        Replace
      </Button>
    </form>
  );
}
