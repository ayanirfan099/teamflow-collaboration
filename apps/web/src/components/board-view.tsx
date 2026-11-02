'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, EmptyState, ErrorState, Skeleton } from '@teamflow/ui';
import * as React from 'react';
import type { ColumnDto, TaskDto } from '@teamflow/contracts';
import { useMoveTask, useTasks } from '../lib/queries';
import { TaskCard } from './task-card';

export interface BoardViewProps {
  organizationId: string;
  boardId: string;
  columns: ColumnDto[];
  onOpenTask: (task: TaskDto) => void;
  onCreateTask: (columnId: string) => void;
  /** Switches between the board and the list view. */
  view: 'board' | 'list';
  /** The active filters; the board only shows the matching tasks. */
  filters?: {
    q?: string;
    assigneeId?: string;
    labelIds?: string[];
    priority?: string[];
    due?: 'overdue' | 'today' | 'week' | 'none';
    status?: 'open' | 'done' | 'archived' | 'all';
  };
}

/**
 * The board.
 *
 * A task is dragged with the pointer; every card also has a "Move to…" menu, so the board can
 * be used without a pointer. The move is applied optimistically and rolled back when the
 * request fails.
 */
export function BoardView({
  organizationId,
  boardId,
  columns,
  onOpenTask,
  onCreateTask,
  view,
  filters,
}: BoardViewProps) {
  const { data, isLoading, isError, refetch } = useTasks(organizationId, {
    boardId,
    status: filters?.status ?? 'all',
    q: filters?.q,
    assigneeId: filters?.assigneeId,
    labelIds: filters?.labelIds,
    priority: filters?.priority,
    due: filters?.due,
    limit: 100,
  });
  const moveTask = useMoveTask(organizationId);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasks = data?.data ?? [];
  const activeTask = activeId ? (tasks.find((task) => task.id === activeId) ?? null) : null;

  function tasksOf(columnId: string): TaskDto[] {
    return tasks.filter((task) => task.columnId === columnId);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      return;
    }

    const task = tasks.find((entry) => entry.id === String(active.id));
    if (!task) {
      return;
    }

    const overId = String(over.id);
    const targetColumn = columns.find((column) => column.id === overId);
    const targetTask = tasks.find((entry) => entry.id === overId);

    const columnId = targetColumn?.id ?? targetTask?.columnId;
    if (!columnId || columnId === task.columnId) {
      return;
    }

    // The task is placed at the end of the target column; the board keeps the order of the
    // remaining tasks.
    moveTask.mutate({
      taskId: task.id,
      columnId,
      afterTaskId: null,
      version: task.version,
    });
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div key={column.id} className="w-72 shrink-0 rounded-xl bg-surface-sunken p-3">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="mb-2 h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="The board could not be loaded." onRetry={() => void refetch()} />;
  }

  if (view === 'list') {
    return (
      <div className="rounded-xl border border-line bg-surface-raised">
        {tasks.length === 0 ? (
          <EmptyState title="No tasks yet" description="Create the first task to get started." />
        ) : (
          <ul className="divide-y divide-line/70">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="w-40 shrink-0 truncate text-sm font-medium text-ink">
                    {task.title}
                  </span>
                  <span className="w-28 shrink-0 truncate text-xs text-ink-faint">
                    {columns.find((column) => column.id === task.columnId)?.name ?? ''}
                  </span>
                  <span className="truncate text-xs text-ink-faint">
                    {task.assignees.map((assignee) => assignee.name).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((column) => {
          const columnTasks = tasksOf(column.id);
          return (
            <section
              key={column.id}
              aria-label={column.name}
              className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-sunken/70 p-3"
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">{column.name}</h3>
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {columnTasks.length}
                  {column.wipLimit ? ` / ${column.wipLimit}` : ''}
                </span>
              </header>

              <SortableContext
                items={columnTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex min-h-16 flex-1 flex-col gap-2">
                  {columnTasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      columns={columns}
                      onOpen={onOpenTask}
                      onMove={(moved, columnId) =>
                        moveTask.mutate({
                          taskId: moved.id,
                          columnId,
                          afterTaskId: null,
                          version: moved.version,
                        })
                      }
                    />
                  ))}
                </div>
              </SortableContext>

              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start"
                onClick={() => onCreateTask(column.id)}
              >
                + Add task
              </Button>
            </section>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            columns={columns}
            onOpen={onOpenTask}
            onMove={() => undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableTask({
  task,
  columns,
  onOpen,
  onMove,
}: {
  task: TaskDto;
  columns: ColumnDto[];
  onOpen: (task: TaskDto) => void;
  onMove: (task: TaskDto, columnId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        columns={columns}
        onOpen={onOpen}
        onMove={onMove}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
