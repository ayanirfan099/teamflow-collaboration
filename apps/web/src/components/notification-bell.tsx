'use client';

import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@teamflow/ui';
import * as React from 'react';
import { useMarkNotificationsRead, useNotifications } from '../lib/queries';
import { formatRelative } from '../lib/format';

export function NotificationBell({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = React.useState(false);
  const { data } = useNotifications(organizationId || null);
  const markRead = useMarkNotificationsRead(organizationId || null);

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            🔔
          </span>
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-contrast">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markRead.mutate({ all: true })}
              loading={markRead.isPending}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <ul className="max-h-80 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-ink-muted">
              Nothing here yet. Mentions and assignments show up in this list.
            </li>
          ) : (
            notifications.map((notification) => (
              <li
                key={notification.id}
                className={`border-b border-line/70 px-3 py-2.5 last:border-b-0 ${
                  notification.readAt ? 'bg-surface-raised' : 'bg-accent-soft/40'
                }`}
              >
                <p className="text-sm font-medium text-ink">{notification.title}</p>
                {notification.body ? (
                  <p className="mt-0.5 text-xs text-ink-muted">{notification.body}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-ink-faint">
                  {formatRelative(notification.createdAt)}
                </p>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return <Badge tone="accent">{count} unread</Badge>;
}
