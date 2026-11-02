'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@teamflow/ui';
import { useParams, useSearchParams } from 'next/navigation';
import * as React from 'react';
import type { TaskDto } from '@teamflow/contracts';
import { BoardView } from '../../../../../../components/board-view';
import { PageHeader } from '../../../../../../components/app-shell';
import { TaskDialog } from '../../../../../../components/task-dialog';
import {
  EMPTY_FILTERS,
  TaskFilterBar,
  type TaskFilters,
} from '../../../../../../components/task-filters';
import {
  useBoards,
  useColumns,
  useCreateTask,
  useLabels,
  useMembers,
  useProject,
  useTasks,
  useUpdateProject,
} from '../../../../../../lib/queries';

export default function ProjectPage() {
  const params = useParams<{ organizationId: string; projectId: string }>();
  const { organizationId, projectId } = params;
  const searchParams = useSearchParams();

  const project = useProject(organizationId, projectId);
  const boards = useBoards(organizationId, projectId);
  const [boardId, setBoardId] = React.useState<string | null>(null);
  const columns = useColumns(organizationId, boardId);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const [creatingInColumn, setCreatingInColumn] = React.useState<string | null>(null);

  // All the tasks of the project, also the completed and the archived ones. The open task is
  // looked up in this list, so the dialog always works with the current version of the task.
  const requestedTask = useTasks(organizationId, {
    projectId,
    status: 'all',
    limit: 100,
  });
  const liveTask =
    openTaskId === null
      ? null
      : ((requestedTask.data?.data ?? []).find((task) => task.id === openTaskId) ?? null);

  // The last known version of the open task. The dialog keeps it while the list is refetched,
  // so the dialog does not close in the middle of a comment and the draft is not lost.
  const lastTask = React.useRef<TaskDto | null>(null);
  React.useEffect(() => {
    if (liveTask) {
      lastTask.current = liveTask;
    }
  }, [liveTask]);
  const openTask = liveTask ?? (openTaskId === null ? null : lastTask.current);

  // A link from the search opens the task directly (`?task=<id>`).
  const requestedTaskId = searchParams.get('task');
  React.useEffect(() => {
    if (!requestedTaskId) {
      return;
    }
    const match = (requestedTask.data?.data ?? []).find((task) => task.id === requestedTaskId);
    if (match) {
      setOpenTaskId(match.id);
    }
  }, [requestedTaskId, requestedTask.data]);

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
          <>
            {boardList.length > 1 ? (
              <>
                <label htmlFor="board-select" className="sr-only">
                  Select board
                </label>
                <Select
                  id="board-select"
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
              </>
            ) : null}
            <ProjectMenu
              organizationId={organizationId}
              projectId={projectId}
              status={project.data?.status ?? 'ACTIVE'}
            />
          </>
        }
      />

      {activeBoardId === null ? (
        <EmptyState title="No board yet" description="This project does not have a board yet." />
      ) : (
        <BoardSection
          organizationId={organizationId}
          projectId={projectId}
          boardId={activeBoardId}
          onOpenTask={(task) => setOpenTaskId(task.id)}
          onCreateTask={(columnId) => setCreatingInColumn(columnId)}
        />
      )}

      <TaskDialog
        organizationId={organizationId}
        task={openTask}
        columns={columns.data ?? []}
        onClose={() => setOpenTaskId(null)}
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

/** The project actions: archiving a project makes it read-only. */
function ProjectMenu({
  organizationId,
  projectId,
  status,
}: {
  organizationId: string;
  projectId: string;
  status: 'ACTIVE' | 'ARCHIVED';
}) {
  const updateProject = useUpdateProject(organizationId);
  const { toast } = useToast();

  async function setStatus(next: 'ACTIVE' | 'ARCHIVED') {
    try {
      await updateProject.mutateAsync({ projectId, body: { status: next } });
      toast({
        title: next === 'ARCHIVED' ? 'Project archived' : 'Project restored',
        tone: 'success',
      });
    } catch (error) {
      toast({
        title: 'The project could not be updated',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm font-medium hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Project actions"
        >
          Actions
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === 'ACTIVE' ? (
          <DropdownMenuItem
            onSelect={() => void setStatus('ARCHIVED')}
            disabled={updateProject.isPending}
          >
            Archive project
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() => void setStatus('ACTIVE')}
            disabled={updateProject.isPending}
          >
            Restore project
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BoardSection({
  organizationId,
  projectId,
  boardId,
  onOpenTask,
  onCreateTask,
}: {
  organizationId: string;
  projectId: string;
  boardId: string;
  onOpenTask: (task: TaskDto) => void;
  onCreateTask: (columnId: string) => void;
}) {
  const columns = useColumns(organizationId, boardId);
  const members = useMembers(organizationId);
  const labels = useLabels(organizationId);
  const [view, setView] = React.useState<'board' | 'list'>('board');
  const [filters, setFilters] = React.useState<TaskFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // The search field is debounced, so a request is not sent per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.q.trim()), 250);
    return () => clearTimeout(timer);
  }, [filters.q]);

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
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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

      <TaskFilterBar
        filters={filters}
        onChange={setFilters}
        members={members.data ?? []}
        labels={labels.data ?? []}
      />

      <BoardView
        organizationId={organizationId}
        boardId={boardId}
        columns={columnList}
        onOpenTask={onOpenTask}
        onCreateTask={onCreateTask}
        view={view}
        filters={{
          q: debouncedSearch || undefined,
          assigneeId: filters.assigneeId || undefined,
          labelIds: filters.labelIds.length > 0 ? filters.labelIds : undefined,
          priority: filters.priority.length > 0 ? filters.priority : undefined,
          due: filters.due || undefined,
          status: filters.status,
        }}
      />

      <p className="sr-only" aria-live="polite">
        {filters.q ? `Filtered by ${filters.q}.` : 'Showing all tasks.'}
      </p>
      <span className="sr-only">{projectId}</span>
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
