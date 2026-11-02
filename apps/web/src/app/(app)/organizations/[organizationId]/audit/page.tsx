'use client';

import { Avatar, Badge, Card, EmptyState, ErrorState, Skeleton } from '@teamflow/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import { useAuditEvents } from '../../../../../lib/queries';
import { formatDateTime } from '../../../../../lib/format';

const ACTION_LABEL: Record<string, string> = {
  ORGANIZATION_CREATED: 'Organization created',
  ORGANIZATION_UPDATED: 'Organization updated',
  ORGANIZATION_DELETED: 'Organization deleted',
  MEMBER_INVITED: 'Member invited',
  MEMBER_JOINED: 'Member joined',
  MEMBER_ROLE_CHANGED: 'Role changed',
  MEMBER_REMOVED: 'Member removed',
  INVITATION_REVOKED: 'Invitation revoked',
  INVITATION_ACCEPTED: 'Invitation accepted',
  INVITATION_DECLINED: 'Invitation declined',
  PROJECT_CREATED: 'Project created',
  PROJECT_UPDATED: 'Project updated',
  PROJECT_ARCHIVED: 'Project archived',
  PROJECT_DELETED: 'Project deleted',
  BOARD_CREATED: 'Board created',
  BOARD_UPDATED: 'Board updated',
  TASK_DELETED: 'Task deleted',
  AUTH_LOGIN: 'Signed in',
  AUTH_LOGIN_FAILED: 'Sign-in failed',
  AUTH_LOGOUT: 'Signed out',
  AUTH_LOGOUT_ALL: 'Signed out everywhere',
  SOCKET_REJECTED: 'Socket rejected',
};

export default function AuditPage() {
  const params = useParams<{ organizationId: string }>();
  const { data, isLoading, isError, refetch } = useAuditEvents(params.organizationId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Audit log" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Audit log" />
        <ErrorState
          title="The audit log is not available"
          message="Only owners and admins can read the audit log of this workspace."
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  const events = data ?? [];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change that matters, who made it and when. Owners and admins only."
      />

      {events.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Membership, role, project and board changes are recorded here."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="flex flex-wrap items-start gap-3 p-3">
                <Avatar name={event.actorName ?? 'System'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{event.actorName ?? 'System'}</p>
                    <Badge tone="neutral">{ACTION_LABEL[event.action] ?? event.action}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {event.targetType}
                    {event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {formatDateTime(event.createdAt)}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ''}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
