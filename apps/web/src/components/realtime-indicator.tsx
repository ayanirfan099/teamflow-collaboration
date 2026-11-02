'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useRealtime } from '../lib/realtime';
import { useSession } from '../lib/session';

/**
 * Shows whether the live connection is up and keeps the queries in sync with the events.
 *
 * The API sends the events of the organization to every member and the notifications of a
 * person to their own channel. The handlers below turn those events into a refresh of the
 * affected queries, so a mention reaches the other members without a reload.
 */
export function RealtimeIndicator() {
  const { activeOrganizationId } = useSession();
  const queryClient = useQueryClient();
  const [online, setOnline] = React.useState(false);

  const handlers = React.useMemo(
    () => ({
      'notification.created': () => {
        void queryClient.invalidateQueries({
          queryKey: ['notifications', activeOrganizationId],
        });
      },
      'comment.created': () => {
        void queryClient.invalidateQueries({ queryKey: ['comments'] });
        void queryClient.invalidateQueries({
          queryKey: ['activity', activeOrganizationId],
        });
      },
      'comment.updated': () => {
        void queryClient.invalidateQueries({ queryKey: ['comments'] });
      },
      'task.created': () => {
        void queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      },
      'task.updated': () => {
        void queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      },
      'task.moved': () => {
        void queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      },
      'task.deleted': () => {
        void queryClient.invalidateQueries({ queryKey: ['tasks', activeOrganizationId] });
      },
    }),
    [queryClient, activeOrganizationId],
  );

  const { status } = useRealtime(activeOrganizationId, handlers);

  React.useEffect(() => {
    setOnline(status === 'online');
  }, [status]);

  return (
    <span
      className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-faint sm:inline-flex"
      title={online ? 'Live updates are connected' : 'Live updates are offline'}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${online ? 'bg-success' : 'bg-ink-faint'}`}
      />
      <span className="sr-only">
        {online ? 'Live updates are connected' : 'Live updates are offline'}
      </span>
    </span>
  );
}
