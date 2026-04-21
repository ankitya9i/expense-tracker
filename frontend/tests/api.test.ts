import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createExpense, listExpenses, ApiError } from '../src/lib/api';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('createExpense', () => {
  it('sends Idempotency-Key header and JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 'abc', amount: '100.00', category: 'Food', description: 'x', date: '2026-04-21', createdAt: '2026-04-21T00:00:00Z' }, 201),
    );
    globalThis.fetch = fetchMock as any;

    await createExpense(
      { amount: '100.00', category: 'Food', description: 'x', date: '2026-04-21' },
      'key-test-1',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('key-test-1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.method).toBe('POST');
  });

  it('retries on 5xx but keeps the same idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ id: 'abc', amount: '100.00', category: 'Food', description: 'x', date: '2026-04-21', createdAt: '2026-04-21T00:00:00Z' }, 201));
    globalThis.fetch = fetchMock as any;

    const result = await createExpense(
      { amount: '100.00', category: 'Food', description: 'x', date: '2026-04-21' },
      'same-key-across-retries',
    );

    expect(result.id).toBe('abc');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('same-key-across-retries');
    }
  }, 10_000);

  it('does NOT retry on 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: 'validation_error', message: 'Amount must be greater than zero' }, 400),
    );
    globalThis.fetch = fetchMock as any;

    await expect(
      createExpense(
        { amount: '0', category: 'Food', description: 'x', date: '2026-04-21' },
        'key-4xx',
      ),
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('listExpenses', () => {
  it('builds query string with both filters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ expenses: [], totalAmount: '0.00', count: 0 }));
    globalThis.fetch = fetchMock as any;

    await listExpenses({ category: 'Food', sort: 'date_desc' });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('category=Food');
    expect(url).toContain('sort=date_desc');
  });

  it('omits query string when no filters provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ expenses: [], totalAmount: '0.00', count: 0 }));
    globalThis.fetch = fetchMock as any;

    await listExpenses({});
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain('?');
  });
});
