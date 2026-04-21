import type {
  CreateExpenseInput,
  ListExpensesResponse,
  Expense,
  SortKey,
  SummaryResponse,
} from '../types/api';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://expense-tracker-production-28a5.up.railway.app';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

type FetchWithRetryOptions = RequestInit & {
  retries?: number;
  backoffMs?: number;
  timeoutMs?: number;
};

async function fetchWithRetry(
  url: string,
  { retries = 3, backoffMs = 300, timeoutMs = 10_000, ...init }: FetchWithRetryOptions = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      // Retry only on 5xx. 4xx is a client error — don't hammer the server.
      if (res.status >= 500 && attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new Error('Request failed');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : undefined) ?? `Request failed with ${res.status}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function listExpenses(params: {
  category?: string;
  sort?: SortKey;
}): Promise<ListExpensesResponse> {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.sort) search.set('sort', params.sort);
  const qs = search.toString();
  const res = await fetchWithRetry(`${API_URL}/expenses${qs ? `?${qs}` : ''}`);
  return parseOrThrow<ListExpensesResponse>(res);
}

export async function getSummary(): Promise<SummaryResponse> {
  const res = await fetchWithRetry(`${API_URL}/expenses/summary`);
  return parseOrThrow<SummaryResponse>(res);
}

export async function createExpense(
  input: CreateExpenseInput,
  idempotencyKey: string,
): Promise<Expense> {
  const res = await fetchWithRetry(`${API_URL}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
    // Idempotency-Key makes POST safe to retry
    retries: 3,
  });
  return parseOrThrow<Expense>(res);
}
