import { rateLimit } from 'express-rate-limit';

const MINUTE = 60_000;

// Each limiter counts requests per IP (per /56 block for IPv6, since one home gets a whole range of addresses).
// Counts live in memory: fine for one server. With several servers, give them a shared store such as Redis.
const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
  });

// A ceiling for the whole API, against scripts hammering any endpoint
export const apiLimiter = limiter(MINUTE, 300);
// Slows down password guessing
export const loginLimiter = limiter(15 * MINUTE, 10);
export const registerLimiter = limiter(60 * MINUTE, 5);
// Each request sends an email, so keep it tight
export const emailLimiter = limiter(60 * MINUTE, 3);
// Browsers report their crashes; one broken page must not flood the log
export const clientErrorLimiter = limiter(MINUTE, 20);
