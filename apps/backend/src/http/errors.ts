import type { NextFunction, Request, Response } from 'express';

// An error that already knows its response. Throw it from a route (even inside a transaction,
// which then rolls back) and errorHandler sends it as { message, code }.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Not found' });
};

const isClientError = (err: unknown): err is { status: number; message: string } =>
  typeof err === 'object' &&
  err !== null &&
  'expose' in err &&
  err.expose === true &&
  'status' in err &&
  typeof err.status === 'number' &&
  err.status >= 400 &&
  err.status < 500;

// Express 5 forwards rejected promises from async handlers here
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.code && { code: err.code }) });
    return;
  }
  // The body parsers' own errors (malformed JSON, a body over the size limit) are the client's mistake
  if (isClientError(err)) {
    res.status(err.status).json({ message: err.message, ...(err.status === 413 && { code: 'TOO_LARGE' }) });
    return;
  }
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  // The request log stores the real error for super admins; the client only gets a generic message
  res.locals.error = err;
  res.status(500).json({ message: 'Internal server error' });
};
