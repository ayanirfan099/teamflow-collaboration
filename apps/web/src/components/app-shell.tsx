'use client';

import {
  Avatar,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  VisuallyHidden,
} from '@teamflow/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { useSession } from '../lib/session';
import { NotificationBell } from './notification-bell';
import { RealtimeIndicator } from './realtime-indicator';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, activeOrganizationId, activeMembership, isLoading, signOut } = useSession();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Loading TeamFlow…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-ink-muted">You are not signed in.</p>
        <Link
          href="/login"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const organizationId = activeOrganizationId ?? '';
  const navItems = [
    { href: '/my-work', label: 'My Work' },
    { href: `/organizations/${organizationId}/projects`, label: 'Projects' },
    { href: `/organizations/${organizationId}/directory`, label: 'Directory' },
    { href: `/organizations/${organizationId}/activity`, label: 'Activity' },
  ];

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/my-work" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-contrast"
            >
              T
            </span>
            <span className="hidden sm:inline">TeamFlow</span>
          </Link>

          <OrganizationSwitcher />

          <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-surface-sunken font-medium text-ink'
                      : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <RealtimeIndicator />
            <NotificationBell organizationId={organizationId} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label="Account menu"
                >
                  <Avatar name={session.user.name} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
                {activeMembership ? (
                  <DropdownMenuLabel>
                    {activeMembership.organizationName} · {activeMembership.role.toLowerCase()}
                  </DropdownMenuLabel>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/my-work">My Work</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav
          aria-label="Main (mobile)"
          className="flex items-center gap-1 overflow-x-auto border-t border-line px-3 py-2 md:hidden"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

function OrganizationSwitcher() {
  const { session, activeOrganizationId, setActiveOrganization } = useSession();
  const memberships = session?.memberships ?? [];
  const current = memberships.find(
    (membership) => membership.organizationId === activeOrganizationId,
  );

  if (memberships.length === 0) {
    return (
      <Badge tone="warning" className="hidden sm:inline-flex">
        No organization
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm font-medium hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={`Switch organization, current: ${current?.organizationName ?? 'none'}`}
        >
          {current?.organizationName ?? 'Select organization'}
          <span aria-hidden="true" className="text-ink-faint">
            ▾
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.organizationId}
            onSelect={() => setActiveOrganization(membership.organizationId)}
          >
            <span className="flex-1">{membership.organizationName}</span>
            {membership.organizationId === activeOrganizationId ? (
              <span aria-hidden="true" className="text-accent">
                ✓
              </span>
            ) : null}
            <VisuallyHidden>
              {membership.organizationId === activeOrganizationId ? ' (current)' : ''}
            </VisuallyHidden>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
