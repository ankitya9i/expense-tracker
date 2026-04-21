import type { Prisma, PrismaClient } from '@prisma/client';
import { paiseToRupeesString, rupeesStringToPaise, sumPaise } from '../lib/money';
import type { CreateExpenseInput, ListExpensesQuery } from '../routes/expenses.schema';

export type ExpenseDTO = {
  id: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  createdAt: string;
};

export type ListExpensesResponse = {
  expenses: ExpenseDTO[];
  totalAmount: string;
  count: number;
};

export type CategorySummaryItem = {
  category: string;
  total: string;
  count: number;
};

export type SummaryResponse = {
  byCategory: CategorySummaryItem[];
  grandTotal: string;
  count: number;
};

type ExpenseRow = {
  id: string;
  amountPaise: bigint;
  category: string;
  description: string;
  date: Date;
  createdAt: Date;
};

function toDTO(row: ExpenseRow): ExpenseDTO {
  return {
    id: row.id,
    amount: paiseToRupeesString(row.amountPaise),
    category: row.category,
    description: row.description,
    date: row.date.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
  };
}

export class ExpenseService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateExpenseInput, idempotencyKey?: string): Promise<ExpenseDTO> {
    const amountPaise = rupeesStringToPaise(input.amount);
    const date = new Date(`${input.date}T00:00:00.000Z`);

    if (!idempotencyKey) {
      const created = await this.prisma.expense.create({
        data: {
          amountPaise,
          category: input.category,
          description: input.description,
          date,
        },
      });
      return toDTO(created);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (existing) {
        const expense = await tx.expense.findUnique({ where: { id: existing.resourceId } });
        if (expense) return toDTO(expense);
      }

      const created = await tx.expense.create({
        data: {
          amountPaise,
          category: input.category,
          description: input.description,
          date,
        },
      });

      await tx.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        create: { key: idempotencyKey, resourceId: created.id },
        update: {},
      });

      return toDTO(created);
    });
  }

  async summary(): Promise<SummaryResponse> {
    const rows = await this.prisma.expense.findMany();
    const grouped = new Map<string, { totalPaise: bigint; count: number }>();
    for (const row of rows) {
      const current = grouped.get(row.category) ?? { totalPaise: 0n, count: 0 };
      grouped.set(row.category, {
        totalPaise: current.totalPaise + row.amountPaise,
        count: current.count + 1,
      });
    }

    const byCategory = Array.from(grouped.entries())
      .map(([category, { totalPaise, count }]) => ({
        category,
        total: paiseToRupeesString(totalPaise),
        count,
        _totalPaise: totalPaise,
      }))
      .sort((a, b) => (b._totalPaise > a._totalPaise ? 1 : b._totalPaise < a._totalPaise ? -1 : 0))
      .map(({ _totalPaise: _omit, ...rest }) => rest);

    const grandTotalPaise = sumPaise(rows.map((r) => r.amountPaise));
    return {
      byCategory,
      grandTotal: paiseToRupeesString(grandTotalPaise),
      count: rows.length,
    };
  }

  async list(query: ListExpensesQuery): Promise<ListExpensesResponse> {
    const where: Prisma.ExpenseWhereInput = {};
    if (query.category) where.category = query.category;

    const orderBy: Prisma.ExpenseOrderByWithRelationInput[] =
      query.sort === 'date_asc'
        ? [{ date: 'asc' }, { createdAt: 'asc' }]
        : [{ date: 'desc' }, { createdAt: 'desc' }];

    const rows = await this.prisma.expense.findMany({ where, orderBy });
    const total = sumPaise(rows.map((r) => r.amountPaise));

    return {
      expenses: rows.map(toDTO),
      totalAmount: paiseToRupeesString(total),
      count: rows.length,
    };
  }
}
