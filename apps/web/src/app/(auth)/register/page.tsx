'use client';

import { Button, Field, Input } from '@teamflow/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { apiSend, errorMessage } from '../../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend('/auth/register', 'POST', {
        name: form.name,
        email: form.email,
        password: form.password,
        ...(form.organizationName ? { organizationName: form.organizationName } : {}),
      });
      router.push('/my-work');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">Start a workspace for your team.</p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Your name" htmlFor="name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint="At least 10 characters. A short phrase works well."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
          />
        </Field>
        <Field
          label="Workspace name"
          htmlFor="organizationName"
          hint="Optional — you can create one later."
        >
          <Input
            id="organizationName"
            name="organizationName"
            value={form.organizationName}
            onChange={(event) => update('organizationName', event.target.value)}
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={busy} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent hover:text-accent-strong">
          Sign in
        </Link>
      </p>
    </div>
  );
}
