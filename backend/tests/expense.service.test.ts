import { describe, it, expect, beforeEach } from 'vitest';
import { ExpenseService } from '../src/services/expense.service';
import { createFakePrisma, type FakePrisma } from './helpers/fake-prisma';

describe('ExpenseService', () => {
  let prisma: FakePrisma;
  let service: ExpenseService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new ExpenseService(prisma as any);
  });

  describe('create', () => {
    it('creates an expense and returns rupees as fixed-2 string', async () => {
      const result = await service.create({
        amount: '100.45',
        category: 'Food',
        description: 'Lunch',
        date: '2026-04-21',
      });
      expect(result.amount).toBe('100.45');
      expect(result.category).toBe('Food');
      expect(result.description).toBe('Lunch');
      expect(result.date).toBe('2026-04-21');
      expect(result.id).toBeTruthy();
      expect(prisma._state.expenses).toHaveLength(1);
    });

    it('stores amount as integer paise internally (no float drift)', async () => {
      await service.create(
        { amount: '0.10', category: 'X', description: 'y', date: '2026-04-21' },
      );
      await service.create(
        { amount: '0.20', category: 'X', description: 'y', date: '2026-04-21' },
      );
      const total = prisma._state.expenses.reduce((a, e) => a + e.amountPaise, 0n);
      expect(total).toBe(30n);
    });
  });

  describe('idempotency', () => {
    const input = {
      amount: '55.00',
      category: 'Food',
      description: 'Snack',
      date: '2026-04-21',
    };

    it('returns the same resource when the same key is reused', async () => {
      const first = await service.create(input, 'key-abc-123');
      const second = await service.create(input, 'key-abc-123');
      expect(second.id).toBe(first.id);
      expect(prisma._state.expenses).toHaveLength(1);
    });

    it('creates distinct resources for different keys', async () => {
      const first = await service.create(input, 'key-one');
      const second = await service.create(input, 'key-two');
      expect(second.id).not.toBe(first.id);
      expect(prisma._state.expenses).toHaveLength(2);
    });

    it('creates a new resource when no key is supplied (even for identical payload)', async () => {
      const first = await service.create(input);
      const second = await service.create(input);
      expect(second.id).not.toBe(first.id);
      expect(prisma._state.expenses).toHaveLength(2);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await service.create({ amount: '10.00', category: 'Food', description: 'a', date: '2026-04-10' });
      await service.create({ amount: '20.00', category: 'Travel', description: 'b', date: '2026-04-20' });
      await service.create({ amount: '30.50', category: 'Food', description: 'c', date: '2026-04-15' });
    });

    it('returns all expenses sorted by date desc by default', async () => {
      const res = await service.list({});
      expect(res.count).toBe(3);
      expect(res.expenses.map((e) => e.date)).toEqual(['2026-04-20', '2026-04-15', '2026-04-10']);
    });

    it('respects sort=date_asc', async () => {
      const res = await service.list({ sort: 'date_asc' });
      expect(res.expenses.map((e) => e.date)).toEqual(['2026-04-10', '2026-04-15', '2026-04-20']);
    });

    it('filters by category', async () => {
      const res = await service.list({ category: 'Food' });
      expect(res.count).toBe(2);
      expect(res.expenses.every((e) => e.category === 'Food')).toBe(true);
    });

    it('returns correct total for filtered list', async () => {
      const res = await service.list({ category: 'Food' });
      expect(res.totalAmount).toBe('40.50');
    });

    it('returns correct total for full list', async () => {
      const res = await service.list({});
      expect(res.totalAmount).toBe('60.50');
    });

    it('returns zero total and empty list for unmatched category', async () => {
      const res = await service.list({ category: 'DoesNotExist' });
      expect(res.count).toBe(0);
      expect(res.totalAmount).toBe('0.00');
    });
  });
});
