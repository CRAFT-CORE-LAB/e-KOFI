'use client';

import { FormEvent, ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  type = 'button',
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles = {
    primary: 'bg-[#14B8A6] text-white hover:bg-[#0f9488]',
    secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#14B8A6]';

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-700">{message}</p>;
}

export function Form({
  onSubmit,
  children,
  className = 'grid gap-4 max-w-xl',
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event);
      }}
    >
      {children}
    </form>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'bad' | 'neutral' }) {
  const map = {
    good: 'bg-[#14B8A6]/15 text-[#0B1F3A]',
    bad: 'bg-red-100 text-red-800',
    neutral: 'bg-stone-100 text-stone-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}
