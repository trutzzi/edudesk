import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
}

const SALT_ROUNDS = 10;

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
};

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

// Accepts a users table row (snake_case columns)
export const generateToken = (user: { id: string; email: string; role: string; school_id: string | null }): string => {
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    schoolId: user.school_id,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '1d' });
};

// What sign-in returns: a token plus the user, in the shape the web app stores
export const toSession = (user: {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string | null;
}) => ({
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
