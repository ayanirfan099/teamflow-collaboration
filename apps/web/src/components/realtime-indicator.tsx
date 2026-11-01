'use client';

import * as React from 'react';
import { useRealtime } from '../lib/realtime';
import { useSession } from '../lib/session';

/** Shows whether the live connection is up. */
export function RealtimeIndicator() {
  const { activeOrganizationId } = useSession();
  const [online, setOnline] = React.useState(false);

  const { status } = useRealtime(activeOrganizationId, {});

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
