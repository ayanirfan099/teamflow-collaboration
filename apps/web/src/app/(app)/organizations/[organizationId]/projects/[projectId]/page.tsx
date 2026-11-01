'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@teamflow/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';
import type { TaskDto } from '@teamflow/contracts';
import { BoardView } from '../../../../../../components/board-view';
import { PageHeader } from '../../../../../../components/app-shell';
import { TaskDialog } from '../../../../../../components/task-dialog';
import { useBoards, useColumns, useCreateTask, useProject } from '../../../../../../lib/queries';

export default function ProjectPage() {
  const params = useParams<{ organizationId: string; projectId: string }>();
  const { organizationId, projectId } = params;

  const project = useProject(organizationId, projectId);
  const boards = useBoards(organizationId, projectId);
  const [boardId, setBoardId] = React.useState<string | null>(null);
  const columns = useColumns(organizationId, boardId);
  const [openTask, setOpenTask] = React.useState<TaskDto | null>(null);
  const [creatingInColumn, setCreatingInColumn] = React.useState<string | null>(null);

  const boardList = boards.data ?? [];
  const activeBoardId = boardId ?? boardList[0]?.id ?? null;

  if (project.isLoading || boards.isLoading) {
    return (
      <>
        <PageHeader title="Loading project…" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (project.isError || boards.isError) {
    return (
      <>
        <PageHeader title="Project" />
        <ErrorState
          message="The project could not be loaded."
          onRetry={() => void project.refetch()}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={project.data?.name ?? 'Project'}
        description={project.data?.description ?? undefined}
        actions={
          boardList.length > 1 ? (
            <Select
              aria-label="Select board"
              className="w-48"
              value={activeBoardId ?? ''}
              onChange={(event) => setBoardId(event.target.value)}
            >
              {boardList.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </Select>
          ) : null
        }
      />

      {activeBoardId === null ? (
        <EmptyState title="No board yet" description="This project does not have a board yet." />
      ) : (
        <BoardSection
          organizationId={organizationId}
          boardId={activeBoardId}
          onOpenTask={setOpenTask}
          onCreateTask={(columnId) => setCreatingInColumn(columnId)}
        />
      )}

      <TaskDialog
        organizationId={organizationId}
        task={openTask}
        columns={columns.data ?? []}
        onClose={() => setOpenTask(null)}
      />

      {creatingInColumn ? (
        <CreateTaskDialog
          organizationId={organizationId}
          projectId={projectId}
          boardId={activeBoardId ?? ''}
          columnId={creatingInColumn}
          onClose={() => setCreatingInColumn(null)}
        />
      ) : null}
    </>
  );
}

function BoardSection({
  organizationId,
  boardId,
  onOpenTask,
  onCreateTask,
}: {
  organizationId: string;
  boardId: string;
  onOpenTask: (task: TaskDto) => void;
  onCreateTask: (columnId: string) => void;
}) {
  const columns = useColumns(organizationId, boardId);
  const [view, setView] = React.useState<'board' | 'list'>('board');

  if (columns.isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (columns.isError) {
    return (
      <ErrorState message="The board could not be loaded." onRetry={() => void columns.refetch()} />
    );
  }

  const columnList = columns.data ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex rounded-lg border border-line p-0.5"
        >
          {(['board', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                view === mode ? 'bg-surface-sunken text-ink' : 'text-ink-muted'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <BoardView
        organizationId={organizationId}
        boardId={boardId}
        columns={columnList}
        onOpenTask={onOpenTask}
        onCreateTask={onCreateTask}
        view={view}
      />
    </div>
  );
}

function CreateTaskDialog({
  organizationId,
  projectId,
  boardId,
  columnId,
  onClose,
}: {
  organizationId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('MEDIUM');
  const createTask = useCreateTask(organizationId);
  const { toast } = useToast();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createTask.mutateAsync({
        title,
        description: description || undefined,
        priority,
        projectId,
        boardId,
        columnId,
      });
      toast({ title: 'Task created', tone: 'success' });
      setTitle('');
      setDescription('');
      onClose();
    } catch (error) {
      toast({
        title: 'The task could not be created',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" htmlFor="new-task-title">
            <Input
              id="new-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={2}
            />
          </Field>
          <Field label="Description" htmlFor="new-task-description">
            <Textarea
              id="new-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label="Priority" htmlFor="new-task-priority">
            <Select
              id="new-task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createTask.isPending}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
