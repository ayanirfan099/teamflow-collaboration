'use client';

import { Avatar, Button, Textarea, useToast } from '@teamflow/ui';
import * as React from 'react';
import type { MemberDto } from '@teamflow/contracts';
import { encodeMentions, renderMentionMarkup } from '@teamflow/contracts';
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from '../lib/queries';
import { formatRelative } from '../lib/format';
import { useSession } from '../lib/session';

export interface CommentThreadProps {
  organizationId: string;
  taskId: string;
  members: MemberDto[];
}

/** The comments of a task, including the mention picker and the edit mode. */
export function CommentThread({ organizationId, taskId, members }: CommentThreadProps) {
  const { data, isLoading } = useComments(organizationId, taskId);
  const createComment = useCreateComment(organizationId, taskId);
  const { toast } = useToast();

  const [body, setBody] = React.useState('');
  const [showMentions, setShowMentions] = React.useState(false);

  const comments = data ?? [];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    try {
      // A mention that was typed by hand is encoded here as well, so "@Ada" notifies Ada.
      await createComment.mutateAsync(encodeMentions(trimmed, members));
      setBody('');
      setShowMentions(false);
    } catch (error) {
      toast({
        title: 'The comment could not be saved',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  function insertMention(member: MemberDto) {
    // The readable name is inserted; the markup is added when the comment is sent.
    setBody((current) => `${current}@${member.name} `);
    setShowMentions(false);
  }

  return (
    <section aria-label="Comments" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">
        Comments <span className="text-ink-faint">({comments.length})</span>
      </h3>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No comments yet. Start the conversation — mention a teammate with @.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              organizationId={organizationId}
              taskId={taskId}
              comment={comment}
              members={members}
            />
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="comment-body" className="sr-only">
          Write a comment
        </label>
        <Textarea
          id="comment-body"
          value={body}
          placeholder="Write a comment — use @ to mention a teammate"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === '@') {
              setShowMentions(true);
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" loading={createComment.isPending} disabled={!body.trim()}>
            Comment
          </Button>
          {showMentions ? (
            <div className="flex flex-wrap items-center gap-1">
              {members.slice(0, 6).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  @{member.name.split(' ')[0]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}

interface CommentItemProps {
  organizationId: string;
  taskId: string;
  members: MemberDto[];
  comment: {
    id: string;
    body: string;
    authorId: string;
    authorName: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * A single comment.
 *
 * The author (and owners and admins) can edit their own comment; the edit is a plain text
 * field, so it works with the keyboard alone.
 */
function CommentItem({ organizationId, taskId, comment, members }: CommentItemProps) {
  const { session, activeMembership } = useSession();
  const updateComment = useUpdateComment(organizationId, taskId);
  const deleteComment = useDeleteComment(organizationId, taskId);
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(() => renderMentionMarkup(comment.body));

  const isAuthor = session?.user.id === comment.authorId;
  const isModerator = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';
  const canEdit = isAuthor || isModerator;
  const wasEdited = comment.updatedAt !== comment.createdAt;

  React.useEffect(() => {
    setDraft(renderMentionMarkup(comment.body));
  }, [comment.body]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    try {
      // The editor shows the readable form, the API stores the mention markup.
      const body = encodeMentions(trimmed, members);
      await updateComment.mutateAsync({ commentId: comment.id, body });
      setEditing(false);
      toast({ title: 'Comment updated', tone: 'success' });
    } catch (error) {
      toast({
        title: 'The comment could not be updated',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  async function remove() {
    try {
      await deleteComment.mutateAsync(comment.id);
      toast({ title: 'Comment deleted', tone: 'success' });
    } catch (error) {
      toast({
        title: 'The comment could not be deleted',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <li className="flex gap-2">
      <Avatar name={comment.authorName} size="sm" />
      <div className="min-w-0 flex-1 rounded-lg bg-surface-sunken/70 px-3 py-2">
        <p className="text-xs font-medium text-ink">
          {comment.authorName}{' '}
          <span className="font-normal text-ink-faint">
            {formatRelative(comment.createdAt)}
            {wasEdited ? ' · edited' : ''}
          </span>
        </p>

        {editing ? (
          <form onSubmit={save} className="mt-1 flex flex-col gap-2">
            <label htmlFor={`edit-comment-${comment.id}`} className="sr-only">
              Edit your comment
            </label>
            <Textarea
              id={`edit-comment-${comment.id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" loading={updateComment.isPending}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(renderMentionMarkup(comment.body));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {renderMentionMarkup(comment.body)}
          </p>
        )}

        {canEdit && !editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(renderMentionMarkup(comment.body));
                setEditing(true);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={deleteComment.isPending && deleteComment.variables === comment.id}
              onClick={() => void remove()}
            >
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
