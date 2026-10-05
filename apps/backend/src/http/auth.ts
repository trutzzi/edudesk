import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../lib/roles.js';
import { verifyToken, type UserPayload } from '../lib/session.js';
import { HttpError } from './errors.js';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

const bearerToken = (req: Request) => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
};

export const authenticateJWT = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) return next(new HttpError(401, 'Missing authentication token'));

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
};

// Like authenticateJWT, but a missing or invalid token just means "anonymous" instead of a 401
export const optionalJWT = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // Treated as anonymous
    }
  }
  next();
};

// After authenticateJWT: only lets the listed roles through
export const requireRole =
  (...roles: Role[]) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to do this'));
    }
    next();
  };

const noSchool = () => new HttpError(403, 'Your account is not linked to a school', 'NO_SCHOOL');

// After authenticateJWT: school data is only reachable by users linked to a school
export const requireSchool = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  next(req.user?.schoolId ? undefined : noSchool());
};

// The signed-in user, for handlers behind authenticateJWT
export function currentUser(req: AuthenticatedRequest) {
  if (!req.user) throw new HttpError(401, 'Missing authentication token');
  return req.user;
}

// The signed-in user's school, for handlers behind requireSchool
export function schoolIdOf(req: AuthenticatedRequest) {
  const schoolId = req.user?.schoolId;
  if (!schoolId) throw noSchool();
  return schoolId;
}
