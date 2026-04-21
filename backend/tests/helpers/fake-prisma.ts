/**
 * Minimal in-memory stand-in for PrismaClient covering the methods the service uses.
 * Not a general-purpose mock — kept small on purpose.
 */

type ExpenseRow = {
  id: string;
  amountPaise: bigint;
  category: string;
  description: string;
  date: Date;
  createdAt: Date;
};

type IdempotencyRow = {
  key: string;
  resourceId: string;
  createdAt: Date;
};

type State = {
  expenses: ExpenseRow[];
  idempotencyKeys: IdempotencyRow[];
};

type OrderBy = { date?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' };

let idCounter = 0;
const nextId = () => `exp_${++idCounter}`;

function compareOrderBy(a: ExpenseRow, b: ExpenseRow, orderBy: OrderBy[]): number {
  for (const clause of orderBy) {
    if (clause.date) {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return clause.date === 'asc' ? diff : -diff;
    }
    if (clause.createdAt) {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      if (diff !== 0) return clause.createdAt === 'asc' ? diff : -diff;
    }
  }
  return 0;
}

function buildFakePrismaForState(state: State) {
  return {
    expense: {
      create: async ({ data }: { data: Omit<ExpenseRow, 'id' | 'createdAt'> }) => {
        const row: ExpenseRow = {
          id: nextId(),
          amountPaise: data.amountPaise,
          category: data.category,
          description: data.description,
          date: data.date,
          createdAt: new Date(),
        };
        state.expenses.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.expenses.find((e) => e.id === where.id) ?? null,
      findMany: async (args: {
        where?: { category?: string };
        orderBy?: OrderBy[];
      } = {}) => {
        let rows = [...state.expenses];
        if (args.where?.category) {
          rows = rows.filter((e) => e.category === args.where!.category);
        }
        if (args.orderBy && args.orderBy.length > 0) {
          rows.sort((a, b) => compareOrderBy(a, b, args.orderBy!));
        }
        return rows;
      },
    },
    idempotencyKey: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        state.idempotencyKeys.find((k) => k.key === where.key) ?? null,
      upsert: async ({
        where,
        create,
      }: {
        where: { key: string };
        create: { key: string; resourceId: string };
        update: Record<string, never>;
      }) => {
        const existing = state.idempotencyKeys.find((k) => k.key === where.key);
        if (existing) return existing;
        const row: IdempotencyRow = { ...create, createdAt: new Date() };
        state.idempotencyKeys.push(row);
        return row;
      },
    },
  };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;

export function createFakePrisma() {
  const state: State = { expenses: [], idempotencyKeys: [] };
  const client = buildFakePrismaForState(state);
  return {
    ...client,
    _state: state,
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>) => fn(client),
    $disconnect: async () => {},
  };
}
