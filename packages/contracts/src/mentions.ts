import { z } from 'zod';
import { idSchema } from './common';

/**
 * Mentions are stored as plain text in a stable, machine readable markup:
 *
 *   `@[Ada Lovelace](user:0f9c0f0e-1b1f-4f2f-9a1e-2f2f0b6a1c33)`
 *
 * The markup keeps the referenced user id next to the display name, so a mention can be
 * resolved without guessing from the display name.
 */
export const MENTION_PATTERN = /@\[([^\]\n]{1,80})\]\(user:([0-9a-fA-F-]{36})\)/g;

export const mentionUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
});

export const parsedMentionSchema = z.object({
  id: idSchema,
  name: z.string(),
  raw: z.string(),
});

export type MentionUser = z.infer<typeof mentionUserSchema>;
export type ParsedMention = z.infer<typeof parsedMentionSchema>;

/** Extracts every mention from a comment body. */
export function parseMentions(body: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const id = match[2];
    const name = match[1];
    if (!id || !name || seen.has(id)) {
      continue;
    }
    seen.add(id);
    mentions.push({ id, name: name.trim(), raw: match[0] });
  }
  return mentions;
}

/**
 * Keeps only the mentioned users that are members of the organization. A mention can never
 * reach a user outside the tenant.
 */
export function resolveMentionUserIds(
  mentions: ParsedMention[],
  members: Array<{ id: string }>,
): string[] {
  const allowed = new Set(members.map((member) => member.id));
  const ids: string[] = [];
  for (const mention of mentions) {
    if (allowed.has(mention.id) && !ids.includes(mention.id)) {
      ids.push(mention.id);
    }
  }
  return ids;
}

/** Renders the stored markup as readable text (`@Ada Lovelace`). */
export function renderMentionMarkup(body: string): string {
  return body.replace(MENTION_PATTERN, (_raw, name: string) => `@${name.trim()}`);
}

/** Builds the markup for a mention. */
export function buildMention(name: string, userId: string): string {
  return `@[${name.trim()}](user:${userId})`;
}

/**
 * Turns the readable form of a comment back into the stored markup.
 *
 * The comment box shows `@Ada Lovelace`, but the API stores `@[Ada Lovelace](user:…)`, so the
 * readable form has to be encoded again before it is sent. The longest names are replaced first,
 * so `@Ann` does not swallow the beginning of `@Anna`.
 */
export function encodeMentions(
  text: string,
  members: Array<{ name: string; userId: string }>,
): string {
  let result = text;
  const sorted = [...members].sort((a, b) => b.name.trim().length - a.name.trim().length);
  for (const member of sorted) {
    const name = member.name.trim();
    if (name === '') {
      continue;
    }
    const markup = buildMention(name, member.userId);
    if (result.includes(markup)) {
      continue;
    }
    result = result.split(`@${name}`).join(markup);
  }
  return result;
}
