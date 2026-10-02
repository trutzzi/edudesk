import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, type UserPayload } from '../utils/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing authentication token' });
    return;
  }

  try {
    req.user = jwt.verify(authHeader.slice('Bearer '.length), getJwtSecret()) as UserPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
};

// Use after authenticateJWT: only lets the listed roles through
export const requireRole =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'You do not have permission to do this' });
      return;
    }
    next();
  };

// Use after authenticateJWT: school data is only reachable by users linked to a school
export const requireSchool = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.schoolId) {
    res.status(403).json({ message: 'Your account is not linked to a school', code: 'NO_SCHOOL' });
    return;
  }
  next();
};

// Like authenticateJWT, but a missing or invalid token just means "anonymous" instead of a 401
export const optionalJWT = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice('Bearer '.length), getJwtSecret()) as UserPayload;
    } catch {
      // Anonymous
    }
  }
  next();
};
