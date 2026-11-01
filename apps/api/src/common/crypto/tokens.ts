import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** A URL safe random token (session token, invitation token). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * The hash of a token that is stored in the database.
 *
 * Tokens are only stored as a SHA-256 hash: a database dump does not allow a session to be
 * hijacked.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compares two strings without leaking their length through the timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
