'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
} from '@teamflow/ui';
import Link from 'next/link';
import * as React from 'react';
import { PageHeader } from '../../../components/app-shell';
import { useDashboard } from '../../../lib/queries';
import { useSession } from '../../../lib/session';
import { PRIORITY_LABEL, PRIORITY_TONE, formatDueDate, isOverdue } from '../../../lib/format';

export default function MyWorkPage() {
  const { activeOrganizationId, session } = useSession();
  const { data, isLoading, isError, refetch } = useDashboard(activeOrganizationId);

  if (isLoading) {
    return (
      <>
        <PageHeader title="My Work" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="My Work" />
        <ErrorState message="Your dashboard could not be loaded." onRetry={() => void refetch()} />
      </>
    );
  }

  const assigned = data?.assigned ?? [];
  const overdue = assigned.filter((task) => isOverdue(task.dueDate) && task.status !== 'DONE');
  const dueSoon = assigned.filter((task) => {
    if (!task.dueDate || task.status === 'DONE' || isOverdue(task.dueDate)) {
      return false;
    }
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <>
      <PageHeader
        title={`Good to see you, ${session?.user.name.split(' ')[0] ?? 'there'}`}
        description="Everything that is assigned to you, grouped by what needs attention first."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-danger-strong">{overdue.length}</p>
            <p className="mt-1 text-sm text-ink-muted">Past their due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Due this week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-ink">{dueSoon.length}</p>
            <p className="mt-1 text-sm text-ink-muted">Due within seven days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed recently</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-success-strong">
              {data?.recentlyCompleted ?? 0}
            </p>
            <p className="mt-1 text-sm text-ink-muted">Shipped in the last 14 days</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="assigned-heading">
        <h2 id="assigned-heading" className="mb-3 text-sm font-semibold text-ink">
          Assigned to you
        </h2>
        {assigned.length === 0 ? (
          <EmptyState
            title="Nothing assigned yet"
            description="When a teammate assigns you a task, it shows up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {assigned.map((task) => (
              <li key={task.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {task.title}
                  </span>
                  <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>
                    {PRIORITY_LABEL[task.priority] ?? task.priority}
                  </Badge>
                  {task.dueDate ? (
                    <span
                      className={`text-xs ${
                        isOverdue(task.dueDate) ? 'font-medium text-danger' : 'text-ink-faint'
                      }`}
                    >
                      {formatDueDate(task.dueDate)}
                    </span>
                  ) : null}
                  {task.projectId ? (
                    <Link
                      href={`/organizations/${activeOrganizationId}/projects/${task.projectId}`}
                      className="text-xs font-medium text-accent hover:text-accent-strong"
                    >
                      Open project
                    </Link>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data?.projects?.length ? (
        <section className="mt-8" aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="mb-3 text-sm font-semibold text-ink">
            Project progress
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((project) => (
              <Card key={project.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                  <span className="text-xs text-ink-faint">
                    {project.completedTasks}/{project.totalTasks}
                  </span>
                </div>
                <ProgressBar
                  className="mt-3"
                  value={project.progress}
                  label={`${project.name} progress`}
                />
                <p className="mt-2 text-xs text-ink-muted">{project.progress}% complete</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
