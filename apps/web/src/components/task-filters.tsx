'use client';

import { Badge, Button, Input, Select } from '@teamflow/ui';
import * as React from 'react';
import type { LabelDto, MemberDto } from '@teamflow/contracts';

export interface TaskFilters {
  q: string;
  assigneeId: string;
  labelIds: string[];
  priority: string[];
  due: '' | 'overdue' | 'today' | 'week' | 'none';
  status: 'open' | 'done' | 'archived' | 'all';
}

export const EMPTY_FILTERS: TaskFilters = {
  q: '',
  assigneeId: '',
  labelIds: [],
  priority: [],
  due: '',
  status: 'open',
};

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export interface TaskFilterBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: MemberDto[];
  labels: LabelDto[];
  resultCount?: number;
}

/**
 * The filter bar of the board.
 *
 * Every filter is a plain control, so the board can be filtered with the keyboard only. The
 * search field is debounced by the caller, so typing does not send a request per keystroke.
 */
export function TaskFilterBar({
  filters,
  onChange,
  members,
  labels,
  resultCount,
}: TaskFilterBarProps) {
  const active =
    filters.q !== '' ||
    filters.assigneeId !== '' ||
    filters.labelIds.length > 0 ||
    filters.priority.length > 0 ||
    filters.due !== '' ||
    filters.status !== 'open';

  function toggleLabel(labelId: string) {
    onChange({
      ...filters,
      labelIds: filters.labelIds.includes(labelId)
        ? filters.labelIds.filter((id) => id !== labelId)
        : [...filters.labelIds, labelId],
    });
  }

  function togglePriority(priority: string) {
    onChange({
      ...filters,
      priority: filters.priority.includes(priority)
        ? filters.priority.filter((entry) => entry !== priority)
        : [...filters.priority, priority],
    });
  }

  return (
    <section aria-label="Filter tasks" className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="task-search" className="sr-only">
            Search tasks
          </label>
          <Input
            id="task-search"
            type="search"
            placeholder="Search title and description…"
            value={filters.q}
            onChange={(event) => onChange({ ...filters, q: event.target.value })}
          />
        </div>

        <div>
          <label htmlFor="task-filter-assignee" className="sr-only">
            Filter by assignee
          </label>
          <Select
            id="task-filter-assignee"
            className="w-44"
            value={filters.assigneeId}
            onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}
          >
            <option value="">Any assignee</option>
            {members.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="task-filter-due" className="sr-only">
            Filter by due date
          </label>
          <Select
            id="task-filter-due"
            className="w-40"
            value={filters.due}
            onChange={(event) =>
              onChange({ ...filters, due: event.target.value as TaskFilters['due'] })
            }
          >
            <option value="">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="none">No due date</option>
          </Select>
        </div>

        <div>
          <label htmlFor="task-filter-status" className="sr-only">
            Filter by status
          </label>
          <Select
            id="task-filter-status"
            className="w-36"
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as TaskFilters['status'] })
            }
          >
            <option value="open">Open</option>
            <option value="done">Completed</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>

        {active ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Clear filters
          </Button>
        ) : null}

        {typeof resultCount === 'number' ? (
          <span className="text-xs text-ink-faint" role="status">
            {resultCount} task{resultCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Priority</span>
        {PRIORITIES.map((priority) => {
          const selected = filters.priority.includes(priority);
          return (
            <button
              key={priority}
              type="button"
              aria-pressed={selected}
              onClick={() => togglePriority(priority)}
              className={`rounded-full border px-2.5 py-0.5 text-xs capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? 'border-accent bg-accent-soft text-accent-strong'
                  : 'border-line text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              {priority.toLowerCase()}
            </button>
          );
        })}
      </div>

      {labels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Labels</span>
          {labels.map((label) => {
            const selected = filters.labelIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleLabel(label.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selected
                    ? 'border-accent bg-accent-soft text-accent-strong'
                    : 'border-line text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {active ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Filtered view</Badge>
          <span className="text-xs text-ink-muted">
            Only the matching tasks are shown; the board keeps the order of the rest.
          </span>
        </div>
      ) : null}
    </section>
  );
}
