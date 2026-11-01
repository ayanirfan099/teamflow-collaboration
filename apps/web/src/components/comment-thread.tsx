'use client';

import { Avatar, Button, Textarea, useToast } from '@teamflow/ui';
import * as React from 'react';
import type { MemberDto } from '@teamflow/contracts';
import { buildMention } from '@teamflow/contracts';
import { useComments, useCreateComment } from '../lib/queries';
import { formatRelative } from '../lib/format';

export interface CommentThreadProps {
  organizationId: string;
  taskId: string;
  members: MemberDto[];
}

/** The comments of a task, including the mention picker. */
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
      await createComment.mutateAsync(trimmed);
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
    setBody((current) => `${current}${buildMention(member.name, member.userId)} `);
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
            <li key={comment.id} className="flex gap-2">
              <Avatar name={comment.authorName} size="sm" />
              <div className="min-w-0 flex-1 rounded-lg bg-surface-sunken/70 px-3 py-2">
                <p className="text-xs font-medium text-ink">
                  {comment.authorName}{' '}
                  <span className="font-normal text-ink-faint">
                    {formatRelative(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
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
