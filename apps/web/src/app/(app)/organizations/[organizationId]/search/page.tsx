'use client';

import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@teamflow/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import {
  EMPTY_FILTERS,
  TaskFilterBar,
  type TaskFilters,
} from '../../../../../components/task-filters';
import { useLabels, useMembers, useTasks } from '../../../../../lib/queries';
import { PRIORITY_LABEL, PRIORITY_TONE, formatDueDate, isOverdue } from '../../../../../lib/format';

/**
 * The global task search of the active organization.
 *
 * It uses the same filters as the board, so a query can be carried over to a project.
 */
export default function SearchPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const members = useMembers(organizationId);
  const labels = useLabels(organizationId);
  const [filters, setFilters] = React.useState<TaskFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q.trim()), 250);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const tasks = useTasks(organizationId, {
    q: debouncedSearch || undefined,
    assigneeId: filters.assigneeId || undefined,
    labelIds: filters.labelIds.length > 0 ? filters.labelIds : undefined,
    priority: filters.priority.length > 0 ? filters.priority : undefined,
    due: filters.due || undefined,
    status: filters.status,
    limit: 50,
  });

  const rows = tasks.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Search"
        description="Find tasks in this workspace by title, description, assignee, label, priority and due date."
      />

      <TaskFilterBar
        filters={filters}
        onChange={setFilters}
        members={members.data ?? []}
        labels={labels.data ?? []}
        resultCount={tasks.data ? rows.length : undefined}
      />

      {tasks.isLoading ? (
        <Skeleton className="h-64" />
      ) : tasks.isError ? (
        <ErrorState message="The search failed." onRetry={() => void tasks.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing found"
          description="No task matches these filters. Adjust the search or clear the filters."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((task) => (
            <li key={task.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{task.title}</p>
                  <p className="text-xs text-ink-faint">
                    Task #{task.number}
                    {task.dueDate
                      ? ` · ${formatDueDate(task.dueDate)}${
                          isOverdue(task.dueDate) && task.status === 'OPEN' ? ' (overdue)' : ''
                        }`
                      : ''}
                    {task.assignees.length > 0
                      ? ` · ${task.assignees.map((assignee) => assignee.name).join(', ')}`
                      : ''}
                  </p>
                </div>
                <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>
                  {PRIORITY_LABEL[task.priority] ?? task.priority}
                </Badge>
                {task.status !== 'OPEN' ? (
                  <Badge tone="neutral">{task.status.toLowerCase()}</Badge>
                ) : null}
                <Link
                  href={`/organizations/${organizationId}/projects/${task.projectId}?task=${task.id}`}
                  className="text-xs font-medium text-accent hover:text-accent-strong"
                >
                  Open
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
