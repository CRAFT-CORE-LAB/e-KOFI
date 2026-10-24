'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { Button, Card, ErrorText, Field, Form, PageHeader, inputClass } from '@/components/Ui';
import { api } from '@/lib/api';
import { School, Student } from '@/lib/types';

export default function NewStudentPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<School[]>('/schools').then((data) => {
      setSchools(data);
      if (data[0]) setSchoolId(data[0].id);
    });
  }, []);

  const selected = schools.find((s) => s.id === schoolId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const pin = String(form.get('pin') ?? '');
    setLoading(true);
    setError(null);
    try {
      const student = await api<Student>('/students', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          schoolId,
          classId: form.get('classId'),
          pinEnabled: Boolean(pin),
          pin: pin || undefined,
        }),
      });
      router.replace(`/students/${student.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register student');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <PageHeader title="Register student" subtitle="A unique student ID and empty wallet are created automatically." />
      <Card>
        <Form onSubmit={onSubmit}>
          <Field label="First name">
            <input className={inputClass} name="firstName" required />
          </Field>
          <Field label="Last name">
            <input className={inputClass} name="lastName" required />
          </Field>
          <Field label="School">
            <select className={inputClass} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class">
            <select className={inputClass} name="classId" required>
              {(selected?.classes ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Optional PIN (4–6 digits)">
            <input className={inputClass} name="pin" pattern="\d{4,6}" />
          </Field>
          <ErrorText message={error} />
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Create student'}
          </Button>
        </Form>
      </Card>
    </Shell>
  );
}
