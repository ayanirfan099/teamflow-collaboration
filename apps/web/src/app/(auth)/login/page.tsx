'use client';

import { Button, Field, Input } from '@teamflow/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { apiSend, errorMessage } from '../../../lib/api';
import { useSession } from '../../../lib/session';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend('/auth/login', 'POST', { email, password });
      // The session query failed while the visitor was anonymous; it has to be refetched
      // before the shell can show the workspace.
      await refresh();
      router.push('/my-work');
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to continue to your workspace.</p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        New to TeamFlow?{' '}
        <Link href="/register" className="font-medium text-accent hover:text-accent-strong">
          Create an account
        </Link>
      </p>
    </div>
  );
}
