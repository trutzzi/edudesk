import { createHash, createHmac, randomBytes } from 'node:crypto';
import { getJwtSecret } from './auth.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Keyed hash: without the secret, nobody can check which hash belongs to which IP
export const hashIp = (ip: string) => createHmac('sha256', getJwtSecret()).update(ip).digest('hex');

// A secret for an emailed link. The token goes in the email; only its hash goes in the database,
// so a leaked database can't be used to open anyone's links.
export function newLinkToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

// A link into the web app, e.g. appLink('/verify-email', token)
export function appLink(path: string, token: string) {
  const appUrl = process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  return `${appUrl}${path}?token=${encodeURIComponent(token)}`;
}
