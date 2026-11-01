'use client';

import { Avatar, Card, EmptyState, ErrorState, Skeleton } from '@teamflow/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import { useActivity } from '../../../../../lib/queries';
import { formatRelative } from '../../../../../lib/format';

export default function ActivityPage() {
  const params = useParams<{ organizationId: string }>();
  const { data, isLoading, isError, refetch } = useActivity(params.organizationId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Activity" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Activity" />
        <ErrorState
          message="The activity feed could not be loaded."
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  const events = data ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        description="What happened in this workspace, most recent first."
      />

      {events.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Task and project changes show up here as they happen."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="flex items-start gap-3 p-3">
                <Avatar name={event.actorName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{event.actorName}</span> {event.summary}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">{formatRelative(event.createdAt)}</p>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
