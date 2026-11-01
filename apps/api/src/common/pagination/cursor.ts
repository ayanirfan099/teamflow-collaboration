import { AppException } from '../errors';

/** Encodes the position of the last item into an opaque cursor. */
export function encodeCursor(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** Decodes a cursor. An unreadable cursor is a client error, not a server error. */
export function decodeCursor(cursor: string | undefined): Record<string, string> | null {
  if (!cursor) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    return Object.fromEntries(entries);
  } catch {
    throw AppException.badRequest('bad_request', 'The cursor is not valid.');
  }
}
