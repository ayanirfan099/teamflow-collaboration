import { Readable } from 'node:stream';

/** The token under which the configured storage driver is provided. */
export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/**
 * The storage abstraction for attachments.
 *
 * The API never talks to a concrete storage system: it hands a **randomised key** and a body
 * to the driver and gets a stream back. The original file name is metadata in the database and
 * never becomes part of a path.
 */
export interface StorageDriver {
  /** The name of the driver, used in the health output. */
  readonly name: 'local' | 's3';

  /** Stores an object under the given key. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Reads an object. Returns `null` when the key does not exist. */
  get(key: string): Promise<{ stream: Readable; size: number } | null>;

  /** Removes an object. Removing a missing key is not an error. */
  delete(key: string): Promise<void>;
}

/**
 * Builds a random storage key.
 *
 * The key consists of a random UUID and a random suffix, sharded into two directories so that
 * a directory never holds a huge number of files. It never contains the file name.
 */
export function buildStorageKey(): string {
  const random = Math.random().toString(36).slice(2, 10);
  const uuid = globalThis.crypto.randomUUID().replace(/-/g, '');
  return `${uuid.slice(0, 2)}/${uuid.slice(2, 4)}/${uuid}${random}`;
}
