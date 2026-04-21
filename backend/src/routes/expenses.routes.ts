import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { ExpenseService } from '../services/expense.service';
import { createExpenseSchema, listExpensesQuerySchema } from './expenses.schema';
import { idempotencyKey } from '../middleware/idempotency';

export function buildExpensesRouter(prisma: PrismaClient) {
  const router = Router();
  const service = new ExpenseService(prisma);

  router.post('/', idempotencyKey, async (req, res, next) => {
    try {
      const body = createExpenseSchema.parse(req.body);
      const created = await service.create(body, req.idempotencyKey);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const query = listExpensesQuerySchema.parse(req.query);
      const result = await service.list(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/summary', async (_req, res, next) => {
    try {
      const result = await service.summary();
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
