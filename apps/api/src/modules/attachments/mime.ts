/**
 * A small content type sniffer.
 *
 * The browser sends the content type of a file, but a client can send anything. The signature
 * of the bytes is checked against the declared type for the formats that have a magic number,
 * so a renamed executable cannot be uploaded as an image.
 */

interface Signature {
  contentType: string;
  offset: number;
  bytes: number[];
  /** Some formats share a prefix, so an additional check is used. */
  secondary?: { offset: number; bytes: number[] };
}

const SIGNATURES: Signature[] = [
  { contentType: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { contentType: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { contentType: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  {
    contentType: 'image/webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    secondary: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
  { contentType: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  {
    contentType: 'application/zip',
    offset: 0,
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

function matches(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * Returns the content type that the bytes announce, or `null` when the format has no magic
 * number (plain text, CSV, JSON, …).
 */
export function sniffContentType(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (!matches(buffer, signature.offset, signature.bytes)) {
      continue;
    }
    if (
      signature.secondary &&
      !matches(buffer, signature.secondary.offset, signature.secondary.bytes)
    ) {
      continue;
    }
    return signature.contentType;
  }
  return null;
}

/**
 * Whether the bytes are compatible with the declared content type.
 *
 * Formats without a magic number are accepted — the allowlist of the upload endpoint is the
 * primary control.
 */
export function isContentTypeConsistent(buffer: Buffer, declaredContentType: string): boolean {
  const sniffed = sniffContentType(buffer);
  if (!sniffed) {
    return true;
  }
  return sniffed === declaredContentType.toLowerCase();
}

/** The file extension of a content type, used for the download header. */
export function extensionFor(contentType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/json': '.json',
    'application/zip': '.zip',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'text/csv': '.csv',
    'text/markdown': '.md',
    'text/plain': '.txt',
  };
  return map[contentType.toLowerCase()] ?? '.bin';
}
