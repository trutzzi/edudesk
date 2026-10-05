import { createHash, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Keyed hash: without the secret, nobody can check which hash belongs to which IP
export const hashIp = (ip: string) => createHmac('sha256', env.jwtSecret).update(ip).digest('hex');

// A secret for an emailed link. The token goes in the email; only its hash goes in the database,
// so a leaked database can't be used to open anyone's links.
export function newLinkToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

// A link into the web app, e.g. appLink('/verify-email', token)
export function appLink(path: string, token: string) {
  return `${env.appUrl}${path}?token=${encodeURIComponent(token)}`;
}
