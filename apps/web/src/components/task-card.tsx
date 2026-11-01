'use client';

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@teamflow/ui';
import * as React from 'react';
import type { TaskDto } from '@teamflow/contracts';
import { PRIORITY_LABEL, PRIORITY_TONE, formatDueDate, isOverdue } from '../lib/format';

export interface TaskCardProps {
  task: TaskDto;
  columns: Array<{ id: string; name: string }>;
  onOpen: (task: TaskDto) => void;
  onMove: (task: TaskDto, columnId: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

/**
 * A task on the board.
 *
 * The card can be dragged with the pointer, but every card also offers a "Move to…" menu, so
 * the board is fully usable with the keyboard alone.
 */
export function TaskCard({
  task,
  columns,
  onOpen,
  onMove,
  dragHandleProps,
  isDragging = false,
}: TaskCardProps) {
  const due = formatDueDate(task.dueDate);
  const overdue = isOverdue(task.dueDate);

  return (
    <article
      className={`rounded-lg border border-line bg-surface-raised p-3 shadow-sm shadow-black/[0.03] ${
        isDragging ? 'opacity-60' : ''
      }`}
      aria-label={task.title}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => onOpen(task)}
        >
          <span className="block text-sm font-medium leading-snug text-ink">{task.title}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Move ${task.title} to another column`}
              {...dragHandleProps}
            >
              <span aria-hidden="true">⠿</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to…</DropdownMenuLabel>
            {columns.map((column) => (
              <DropdownMenuItem
                key={column.id}
                disabled={column.id === task.columnId}
                onSelect={() => onMove(task, column.id)}
              >
                {column.name}
                {column.id === task.columnId ? (
                  <span aria-hidden="true" className="text-accent">
                    ✓
                  </span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={PRIORITY_TONE[task.priority] ?? 'neutral'}>
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </Badge>
        {due ? (
          <span className={`text-xs ${overdue ? 'font-medium text-danger' : 'text-ink-faint'}`}>
            {overdue ? 'Overdue · ' : ''}
            {due}
          </span>
        ) : null}
        {task.labels.map((label) => (
          <span
            key={label.id}
            className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${label.color}22`, color: label.color }}
          >
            {label.name}
          </span>
        ))}
        {task.assignees.length > 0 ? (
          <span className="ml-auto text-[11px] text-ink-faint">
            {task.assignees.map((assignee) => assignee.name.split(' ')[0]).join(', ')}
          </span>
        ) : null}
      </div>
    </article>
  );
}
