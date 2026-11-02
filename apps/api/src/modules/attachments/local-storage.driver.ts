import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { StorageDriver } from './storage';

/**
 * The local filesystem driver.
 *
 * It is the development default: the files live in `STORAGE_DIR` and the driver resolves
 * every key inside that directory, so a key can never escape it.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  private pathFor(key: string): string {
    const target = resolve(join(this.root, key));
    if (!target.startsWith(`${this.root}/`) && target !== this.root) {
      throw new Error('The storage key points outside of the storage directory.');
    }
    return target;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<{ stream: Readable; size: number } | null> {
    const target = this.pathFor(key);
    try {
      const info = await stat(target);
      return { stream: createReadStream(target), size: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
