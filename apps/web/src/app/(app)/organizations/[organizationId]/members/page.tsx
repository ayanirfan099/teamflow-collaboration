'use client';

import {
  Avatar,
  Badge,
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
  Select,
  Skeleton,
  useToast,
} from '@teamflow/ui';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { PageHeader } from '../../../../../components/app-shell';
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../../../../lib/queries';
import { ROLE_LABEL } from '../../../../../lib/format';
import { useSession } from '../../../../../lib/session';

const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;

export default function MembersPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const { data, isLoading, isError, refetch } = useMembers(organizationId);
  const { activeMembership } = useSession();
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const canManage = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  if (isLoading) {
    return (
      <>
        <PageHeader title="Members" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Members" />
        <ErrorState message="The members could not be loaded." onRetry={() => void refetch()} />
      </>
    );
  }

  const members = data ?? [];

  return (
    <>
      <PageHeader
        title="Members"
        description="Who is in this workspace, with their role."
        actions={
          canManage ? <Button onClick={() => setInviteOpen(true)}>Invite a member</Button> : null
        }
      />

      {!canManage ? (
        <p className="mb-4 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
          Only owners and admins can invite people or change a role.
        </p>
      ) : null}

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Invite a teammate to collaborate on the projects of this workspace."
          action={
            canManage ? (
              <Button onClick={() => setInviteOpen(true)}>Invite the first member</Button>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id}>
              <MemberRow organizationId={organizationId} member={member} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}

      <InviteDialog
        organizationId={organizationId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </>
  );
}

function MemberRow({
  organizationId,
  member,
  canManage,
}: {
  organizationId: string;
  member: {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    joinedAt: string;
    openTaskCount?: number;
  };
  canManage: boolean;
}) {
  const updateRole = useUpdateMemberRole(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);

  async function changeRole(role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    try {
      await updateRole.mutateAsync({ membershipId: member.id, role });
      toast({
        title: `${member.name} is now a ${ROLE_LABEL[role]?.toLowerCase()}.`,
        tone: 'success',
      });
    } catch (error) {
      toast({
        title: 'The role could not be changed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  async function remove() {
    try {
      await removeMember.mutateAsync(member.id);
      toast({ title: `${member.name} was removed.`, tone: 'success' });
      setConfirming(false);
    } catch (error) {
      toast({
        title: 'The member could not be removed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Avatar name={member.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
        <p className="truncate text-xs text-ink-muted">{member.email}</p>
      </div>

      <Badge tone={member.role === 'OWNER' ? 'accent' : 'neutral'}>
        {ROLE_LABEL[member.role] ?? member.role}
      </Badge>

      {canManage && member.role !== 'OWNER' ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`role-${member.id}`}>
            Role of {member.name}
          </label>
          <Select
            id={`role-${member.id}`}
            className="w-32"
            value={member.role}
            disabled={updateRole.isPending}
            onChange={(event) =>
              void changeRole(event.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')
            }
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>

          {confirming ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="danger"
                loading={removeMember.isPending}
                onClick={() => void remove()}
              >
                Remove
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function InviteDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const invite = useInviteMember(organizationId);
  const { toast } = useToast();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const invitation = await invite.mutateAsync({ email, role });
      toast({
        title: 'Invitation created',
        description: `Share this link with ${email}: ${invitation.acceptUrl}`,
        tone: 'success',
      });
      setEmail('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'The invitation could not be created',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email address" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <Select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
            >
              {ASSIGNABLE_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.isPending}>
              Create invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
