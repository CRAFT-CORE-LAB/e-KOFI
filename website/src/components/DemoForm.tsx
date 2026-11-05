'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Errors = Partial<Record<'school' | 'name' | 'role' | 'phone' | 'email', string>>;

const roles = ['School leader', 'Parent', 'Canteen operator', 'Other'];

export function DemoForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (schoolName) headingRef.current?.focus();
  }, [schoolName]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const school = String(data.get('school') ?? '').trim();
    const name = String(data.get('name') ?? '').trim();
    const role = String(data.get('role') ?? '').trim();
    const phone = String(data.get('phone') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const next: Errors = {};

    if (school.length < 2) next.school = 'Enter the school name.';
    if (name.length < 2) next.name = 'Enter your name.';
    if (!roles.includes(role)) next.role = 'Choose your role.';
    if (phone.replace(/\D/g, '').length < 8) next.phone = 'Enter a phone number we can call.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';

    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSchoolName(school);
  }

  if (schoolName) {
    return (
      <div className="rounded-[18px] border border-navy/10 bg-white p-8" role="status">
        <p className="text-sm font-semibold text-pine">Request received</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight text-navy outline-none">
          We will contact your school.
        </h2>
        <p className="mt-4 text-lg leading-8 text-navy/75">
          Thank you. e-KOFI will be in touch about {schoolName}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-[18px] border border-navy/10 bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-semibold text-navy">Tell us about your school</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        A short note is enough. We reply to schools, parents, and canteen operators.
      </p>
      <div className="mt-6 grid gap-4">
        <Field label="School name" name="school" error={errors.school} autoComplete="organization" />
        <Field label="Your name" name="name" error={errors.name} autoComplete="name" />
        <label className="block text-sm font-semibold text-navy">
          Role
          <select
            name="role"
            defaultValue=""
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={errors.role ? 'role-error' : undefined}
            className="mt-2 h-12 w-full rounded-[14px] border border-navy/10 bg-cream px-3 font-normal text-navy"
          >
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
          {errors.role ? (
            <span id="role-error" className="mt-1 block font-normal text-[#9F2D22]">
              {errors.role}
            </span>
          ) : null}
        </label>
        <Field label="Phone" name="phone" error={errors.phone} autoComplete="tel" inputMode="tel" placeholder="078 000 0000" />
        <Field label="Email" name="email" type="email" error={errors.email} autoComplete="email" />
        <label className="block text-sm font-semibold text-navy">
          Note
          <textarea
            name="note"
            rows={4}
            className="mt-2 w-full rounded-[14px] border border-navy/10 bg-cream px-3 py-3 font-normal text-navy"
            placeholder="What would you like to see?"
          />
        </label>
      </div>
      <button
        type="submit"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-navy text-sm font-semibold text-white hover:bg-[#16345c]"
      >
        Request a demo
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
}: {
  label: string;
  name: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'tel' | 'email' | 'text';
  placeholder?: string;
}) {
  const errorId = `${name}-error`;
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-2 h-12 w-full rounded-[14px] border border-navy/10 bg-cream px-3 font-normal text-navy placeholder:text-muted"
      />
      {error ? (
        <span id={errorId} className="mt-1 block font-normal text-[#9F2D22]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
