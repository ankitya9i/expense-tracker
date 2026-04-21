import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import type { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { logger } from './lib/logger';
import { buildExpensesRouter } from './routes/expenses.routes';
import { errorHandler } from './middleware/error-handler';

export function buildApp(prisma: PrismaClient) {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN.split(',').map((o) => o.trim()),
      credentials: false,
    }),
  );

  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/expenses', buildExpensesRouter(prisma));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}
