import type { RequestHandler } from 'express';
import { HttpError } from './error-handler';

const KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

export const idempotencyKey: RequestHandler = (req, _res, next) => {
  const raw = req.header('Idempotency-Key');
  if (!raw) return next();

  if (!KEY_REGEX.test(raw)) {
    return next(
      new HttpError(
        400,
        'Idempotency-Key must be 8-128 chars, alphanumerics, "-" or "_"',
        'invalid_idempotency_key',
      ),
    );
  }

  req.idempotencyKey = raw;
  next();
};
