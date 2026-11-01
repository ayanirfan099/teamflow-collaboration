'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from '@teamflow/ui';
import * as React from 'react';
import type { ColumnDto, TaskDto } from '@teamflow/contracts';
import { useMembers, useUpdateTask } from '../lib/queries';
import { CommentThread } from './comment-thread';

export interface TaskDialogProps {
  organizationId: string;
  task: TaskDto | null;
  columns: ColumnDto[];
  onClose: () => void;
}

/** The detail view of a task: fields, assignees and comments. */
export function TaskDialog({ organizationId, task, columns, onClose }: TaskDialogProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('MEDIUM');
  const [dueDate, setDueDate] = React.useState('');
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const updateTask = useUpdateTask(organizationId);
  const { data: members } = useMembers(organizationId);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!task) {
      return;
    }
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setAssigneeIds(task.assignees.map((assignee) => assignee.userId));
  }, [task]);

  if (!task) {
    return null;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) {
      return;
    }
    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        body: {
          title,
          description: description || null,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assigneeIds,
          version: task.version,
        },
      });
      toast({ title: 'Task saved', tone: 'success' });
      onClose();
    } catch (error) {
      toast({
        title: 'The task could not be saved',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            Task #{task.number} · {columns.find((column) => column.id === task.columnId)?.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="flex flex-col gap-4">
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </Field>

          <Field label="Description" htmlFor="task-description">
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </Field>

            <Field label="Due date" htmlFor="task-due-date">
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Assignees</legend>
            <div className="flex flex-wrap gap-2">
              {(members ?? []).map((member) => {
                const selected = assigneeIds.includes(member.userId);
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setAssigneeIds((current) =>
                        selected
                          ? current.filter((id) => id !== member.userId)
                          : [...current, member.userId],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      selected
                        ? 'border-accent bg-accent-soft text-accent-strong'
                        : 'border-line text-ink-muted hover:bg-surface-sunken'
                    }`}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Version {task.version}</Badge>
            <span className="text-xs text-ink-faint">
              Updated {new Date(task.updatedAt).toLocaleString()}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" loading={updateTask.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-6 border-t border-line pt-4">
          <CommentThread organizationId={organizationId} taskId={task.id} members={members ?? []} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
