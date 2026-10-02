import type { NextFunction, Response } from 'express';
import { normalizePath, recordLog, SLOW_REQUEST_MS } from '../utils/logs.js';
import type { AuthenticatedRequest } from './auth.js';

// Logs every request that fails (4xx as warnings, 5xx as errors) or is slow, once its response is sent.
// Mounted first, so it times the whole request and sees the user that authentication adds later.
export const requestLogger = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const started = process.hrtime.bigint();

  // Keep the message and code the client was given, without ever logging request or response bodies
  const json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === 'object') {
      const { message, code } = body as { message?: unknown; code?: unknown };
      if (typeof message === 'string') res.locals.logMessage = message;
      if (typeof code === 'string') res.locals.logCode = code;
    }
    return json(body);
  };

  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const failed = res.statusCode >= 400;
    if (!failed && durationMs < SLOW_REQUEST_MS) return;

    const error = res.locals.error as Error | undefined;
    void recordLog({
      level: res.statusCode >= 500 ? 'error' : 'warn',
      source: 'api',
      method: req.method,
      path: normalizePath(req.originalUrl),
      status: res.statusCode,
      durationMs,
      message: failed ? res.locals.logMessage : `Slow request: ${durationMs} ms`,
      code: res.locals.logCode,
      detail: error?.stack ?? error?.message,
      userId: req.user?.id,
      schoolId: req.user?.schoolId,
    });
  });

  next();
};
