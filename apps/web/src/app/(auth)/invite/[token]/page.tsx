'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@teamflow/ui';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { apiGet, apiSend, errorMessage } from '../../../../lib/api';
import { useSession } from '../../../../lib/session';

interface InvitationPreview {
  organizationName: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading, refresh } = useSession();
  const [invitation, setInvitation] = React.useState<InvitationPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiGet<InvitationPreview>(`/invitations/${params.token}`);
        if (!cancelled) {
          setInvitation(response.data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(errorMessage(caught));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/invitations/accept', 'POST', { token: params.token });
      // The new membership has to be known before the workspace can be shown.
      await refresh();
      router.push('/my-work');
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  if (error && !invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation is not usable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-ink-muted">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invitation?.organizationName ?? 'the workspace'}</CardTitle>
      </CardHeader>
      <CardContent>
        {invitation ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              You have been invited as{' '}
              <span className="font-medium text-ink">{invitation.role.toLowerCase()}</span>.
            </p>
            {!isAuthenticated && !isLoading ? (
              <p className="text-sm text-ink-muted">
                Please sign in with <span className="font-medium text-ink">{invitation.email}</span>{' '}
                to accept the invitation.
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
              >
                {error}
              </p>
            ) : null}
            <Button onClick={() => void accept()} loading={busy} disabled={!isAuthenticated}>
              Accept invitation
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Loading invitation…</p>
        )}
      </CardContent>
    </Card>
  );
}
