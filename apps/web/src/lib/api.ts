/**
 * Typed fetch wrapper for the TeamFlow API.
 *
 * Every request goes to the same origin (`/api/v1/...`), so the session cookie is always
 * first-party. The response envelope is unwrapped here: `apiGet` returns `{ data, meta }`.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
    this.requestId = body.error.requestId;
  }
}

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

const CSRF_COOKIE = 'tf_csrf';

/** Reads the CSRF token that the API set as a readable cookie. */
export function readCsrfToken(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : '';
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null | Array<string>>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function buildQuery(query: RequestOptions['query']): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }
    params.append(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Envelope<T>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (method !== 'GET') {
    const token = readCsrfToken();
    if (token) {
      headers['x-csrf-token'] = token;
    }
  }

  const response = await fetch(`/api/v1${path}${buildQuery(options.query)}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    const body = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(
      response.status,
      body.error
        ? (body as ApiErrorBody)
        : {
            error: {
              code: 'unexpected_error',
              message: `Request failed with status ${response.status}.`,
            },
          },
    );
  }

  return (payload ?? { data: null as unknown as T }) as Envelope<T>;
}

export async function apiGet<T>(
  path: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<Envelope<T>> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  options: Omit<RequestOptions, 'method' | 'body'> = {},
): Promise<Envelope<T>> {
  return apiRequest<T>(path, { ...options, method, body });
}

/** A human readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
}
