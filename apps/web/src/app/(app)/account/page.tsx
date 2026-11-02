'use client';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from '@teamflow/ui';
import * as React from 'react';
import { PageHeader } from '../../../components/app-shell';
import { useSessions, useSignOutEverywhere } from '../../../lib/queries';
import { formatDateTime, formatRelative } from '../../../lib/format';

export default function AccountPage() {
  const sessions = useSessions();
  const signOutEverywhere = useSignOutEverywhere();
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);

  async function revokeAll() {
    try {
      const result = await signOutEverywhere.mutateAsync();
      toast({
        title: 'Signed out everywhere',
        description: `${result.revokedSessions} session(s) were revoked.`,
        tone: 'success',
      });
      setConfirming(false);
      window.location.href = '/login';
    } catch (error) {
      toast({
        title: 'The sessions could not be revoked',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Account"
        description="Your sessions. Revoke them all if a device was lost."
        actions={
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Sign out everywhere
          </Button>
        }
      />

      {sessions.isLoading ? (
        <Skeleton className="h-40" />
      ) : sessions.isError ? (
        <ErrorState
          message="The sessions could not be loaded."
          onRetry={() => void sessions.refetch()}
        />
      ) : (sessions.data ?? []).length === 0 ? (
        <EmptyState title="No active sessions" description="You are signed in with this device." />
      ) : (
        <ul className="flex flex-col gap-2">
          {(sessions.data ?? []).map((session) => (
            <li key={session.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {session.userAgent ?? 'Unknown device'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Signed in {formatRelative(session.createdAt)} · last seen{' '}
                    {formatRelative(session.lastSeenAt)}
                  </p>
                  <p className="text-xs text-ink-faint">
                    Expires {formatDateTime(session.expiresAt)}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out everywhere?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-muted">
            Every session of your account is revoked, including this one. You have to sign in again
            on every device.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={signOutEverywhere.isPending}
              onClick={() => void revokeAll()}
            >
              Sign out everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
