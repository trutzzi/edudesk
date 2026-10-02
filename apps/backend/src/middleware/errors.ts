import type { NextFunction, Request, Response } from 'express';

// An error that already knows its response. Throw it from a route (even inside a transaction,
// which then rolls back) and errorHandler sends it as { message, code }.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Not found' });
};

// Express 5 forwards rejected promises from async handlers here
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.code && { code: err.code }) });
    return;
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  // The request log stores the real error for super admins; the client only gets a generic message
  res.locals.error = err;
  res.status(500).json({ message: 'Internal server error' });
};
