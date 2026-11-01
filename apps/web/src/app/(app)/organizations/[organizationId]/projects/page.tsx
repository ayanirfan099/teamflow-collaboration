'use client';

import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Textarea,
  Skeleton,
  useToast,
} from '@teamflow/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import { useCreateProject, useProjects } from '../../../../../lib/queries';

export default function ProjectsPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const { data, isLoading, isError, refetch } = useProjects(organizationId);
  const [open, setOpen] = React.useState(false);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Projects" />
        <Skeleton className="h-40" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Projects" />
        <ErrorState message="The projects could not be loaded." onRetry={() => void refetch()} />
      </>
    );
  }

  const projects = data ?? [];

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project in this workspace."
        actions={<Button onClick={() => setOpen(true)}>New project</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to organise boards, tasks and the people working on them."
          action={<Button onClick={() => setOpen(true)}>Create the first project</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="h-full p-4 transition-colors hover:border-line-strong">
                <Link
                  href={`/organizations/${organizationId}/projects/${project.id}`}
                  className="block rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color ?? '#b24a2e' }}
                    />
                    <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
                  </div>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    {project.key}
                  </p>
                  {project.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                      {project.description}
                    </p>
                  ) : null}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CreateProjectDialog organizationId={organizationId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = React.useState('');
  const [key, setKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const createProject = useCreateProject(organizationId);
  const { toast } = useToast();

  React.useEffect(() => {
    setKey(
      name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase(),
    );
  }, [name]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createProject.mutateAsync({ name, key, description });
      toast({ title: 'Project created', tone: 'success' });
      setName('');
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'The project could not be created',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name" htmlFor="project-name">
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
            />
          </Field>
          <Field label="Key" htmlFor="project-key" hint="Short prefix used in task numbers.">
            <Input
              id="project-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              required
              maxLength={6}
            />
          </Field>
          <Field label="Description" htmlFor="project-description">
            <Textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createProject.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
