'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Badge, Button, Card, Field, PageHeader, inputClass } from '@/components/Ui';
import { api, money } from '@/lib/api';
import { Student } from '@/lib/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(query = q) {
    setLoading(true);
    try {
      const data = await api<Student[]>(`/students${query ? `?q=${encodeURIComponent(query)}` : ''}`);
      setStudents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void load(q);
  }

  return (
    <Shell>
      <PageHeader
        title="Students"
        subtitle="Register, search, and deactivate student accounts."
        action={
          <Link href="/students/new">
            <Button>Register student</Button>
          </Link>
        }
      />
      <form className="mb-4 flex max-w-xl gap-2" onSubmit={onSearch}>
        <input className={inputClass} placeholder="Search name or student ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      {error ? <p className="text-red-700">{error}</p> : null}
      <Card>
        {loading ? (
          <p className="text-sm text-stone-500">Loading students…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-stone-500">
                  <th className="py-2">Student ID</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Wallet</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-stone-100">
                    <td className="py-2">
                      <Link className="text-[#14B8A6] underline" href={`/students/${student.id}`}>
                        {student.studentCode}
                      </Link>
                    </td>
                    <td>
                      {student.lastName} {student.firstName}
                    </td>
                    <td>
                      {student.school.name} / {student.class.name}
                    </td>
                    <td>{student.wallet ? money(student.wallet.balanceRwf) : '—'}</td>
                    <td>
                      <Badge tone={student.status === 'ACTIVE' ? 'good' : 'bad'}>{student.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
