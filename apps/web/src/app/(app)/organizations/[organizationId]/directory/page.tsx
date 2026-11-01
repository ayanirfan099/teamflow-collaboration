'use client';

import { Avatar, Badge, Card, EmptyState, ErrorState, Field, Input, Skeleton } from '@teamflow/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import { useMembers } from '../../../../../lib/queries';
import { ROLE_LABEL } from '../../../../../lib/format';

export default function DirectoryPage() {
  const params = useParams<{ organizationId: string }>();
  const { data, isLoading, isError, refetch } = useMembers(params.organizationId);
  const [query, setQuery] = React.useState('');

  if (isLoading) {
    return (
      <>
        <PageHeader title="Directory" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Directory" />
        <ErrorState message="The directory could not be loaded." onRetry={() => void refetch()} />
      </>
    );
  }

  const members = data ?? [];
  const filtered = members.filter((member) => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return (
      member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <PageHeader
        title="Directory"
        description="Everyone in this workspace, with their role and status."
      />

      <div className="mb-4 max-w-sm">
        <Field label="Search people" htmlFor="directory-search">
          <Input
            id="directory-search"
            type="search"
            placeholder="Name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nobody found" description="Try a different search term." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <li key={member.id}>
              <Card className="flex items-center gap-3 p-4">
                <Avatar name={member.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                  <p className="truncate text-xs text-ink-muted">{member.email}</p>
                </div>
                <Badge tone={member.role === 'OWNER' ? 'accent' : 'neutral'}>
                  {ROLE_LABEL[member.role] ?? member.role}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
