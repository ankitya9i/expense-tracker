import { describe, it, expect } from 'vitest';
import { createExpenseSchema, listExpensesQuerySchema } from '../src/routes/expenses.schema';

describe('createExpenseSchema', () => {
  const base = {
    amount: '100.50',
    category: 'Food',
    description: 'Lunch',
    date: '2026-04-21',
  };

  it('accepts valid input', () => {
    expect(createExpenseSchema.parse(base)).toEqual(base);
  });

  it('rejects zero and negative amounts', () => {
    expect(() => createExpenseSchema.parse({ ...base, amount: '0' })).toThrow();
    expect(() => createExpenseSchema.parse({ ...base, amount: '-5.00' })).toThrow();
  });

  it('rejects more than 2 decimal places', () => {
    expect(() => createExpenseSchema.parse({ ...base, amount: '10.123' })).toThrow();
  });

  it('rejects empty category / description', () => {
    expect(() => createExpenseSchema.parse({ ...base, category: '   ' })).toThrow();
    expect(() => createExpenseSchema.parse({ ...base, description: '' })).toThrow();
  });

  it('rejects invalid date formats', () => {
    expect(() => createExpenseSchema.parse({ ...base, date: '21/04/2026' })).toThrow();
    expect(() => createExpenseSchema.parse({ ...base, date: '2026-13-01' })).toThrow();
    expect(() => createExpenseSchema.parse({ ...base, date: 'not-a-date' })).toThrow();
  });
});

describe('listExpensesQuerySchema', () => {
  it('accepts empty query', () => {
    expect(listExpensesQuerySchema.parse({})).toEqual({});
  });

  it('accepts valid filters', () => {
    expect(listExpensesQuerySchema.parse({ category: 'Food', sort: 'date_desc' })).toEqual({
      category: 'Food',
      sort: 'date_desc',
    });
  });

  it('rejects unsupported sort values', () => {
    expect(() => listExpensesQuerySchema.parse({ sort: 'price_asc' })).toThrow();
  });
});
