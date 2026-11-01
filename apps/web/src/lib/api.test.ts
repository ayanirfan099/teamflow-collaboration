import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, apiGet, buildQuery, errorMessage } from './api';

describe('buildQuery', () => {
  it('skips empty values and joins arrays', () => {
    expect(buildQuery({ a: 'x', b: undefined, c: null, d: '', e: ['1', '2'], f: 3 })).toBe(
      '?a=x&e=1&e=2&f=3',
    );
  });

  it('returns an empty string without a query', () => {
    expect(buildQuery(undefined)).toBe('');
  });
});

describe('apiGet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unwraps the success envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { id: '1' } }),
    });

    const response = await apiGet<{ id: string }>('/things');
    expect(response.data).toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/things',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('throws an ApiError with the error envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          error: { code: 'task_not_found', message: 'Task not found', requestId: 'req-1' },
        }),
    });

    await expect(apiGet('/things/1')).rejects.toBeInstanceOf(ApiError);
    await apiGet('/things/1').catch((error: unknown) => {
      const apiError = error as ApiError;
      expect(apiError.code).toBe('task_not_found');
      expect(apiError.status).toBe(404);
      expect(apiError.requestId).toBe('req-1');
    });
  });

  it('falls back to a generic error for non JSON responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    });

    await apiGet('/things').catch((error: unknown) => {
      const apiError = error as ApiError;
      expect(apiError.code).toBe('unexpected_error');
      expect(errorMessage(apiError)).toContain('502');
    });
  });
});
