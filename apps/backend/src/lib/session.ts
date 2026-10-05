import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from './roles.js';

// What a session token carries
export interface UserPayload {
  id: string;
  email: string;
  role: Role;
  schoolId: string | null;
}

interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string | null;
}

export const generateToken = (user: Pick<UserRecord, 'id' | 'email' | 'role' | 'school_id'>): string => {
  // The role comes from the users table, whose user_role type only holds valid roles
  const payload: UserPayload = { id: user.id, email: user.email, role: user.role as Role, schoolId: user.school_id };
  return jwt.sign(payload, env.jwtSecret, { algorithm: 'HS256', expiresIn: '1d' });
};

export const verifyToken = (token: string) => jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as UserPayload;

// What sign-in returns: a token plus the user, in the shape the web app stores
export const toSession = (user: UserRecord) => ({
  token: generateToken(user),
  user: {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    schoolId: user.school_id,
  },
});
