import { z } from 'zod';

const amountString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a non-negative number with up to 2 decimals')
  .refine((v) => Number(v) > 0, 'Amount must be greater than zero');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be ISO format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Date is invalid');

export const createExpenseSchema = z.object({
  amount: amountString,
  category: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  date: isoDate,
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const listExpensesQuerySchema = z.object({
  category: z.string().trim().min(1).max(64).optional(),
  sort: z.enum(['date_desc', 'date_asc']).optional(),
});

export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
