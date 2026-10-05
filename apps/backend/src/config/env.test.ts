import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, productionConfigProblems } from './env.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env', () => {
  it('reads the JWT secret, and refuses to run without one', () => {
    expect(env.jwtSecret).toBe('test-secret');

    vi.stubEnv('JWT_SECRET', '');
    expect(() => env.jwtSecret).toThrow('JWT_SECRET is not set');
  });

  it('falls back to sensible defaults', () => {
    vi.stubEnv('PORT', '');
    vi.stubEnv('MAX_ACCOUNTS_PER_IP_PER_DAY', '');

    expect(env.port).toBe(4000);
    expect(env.maxAccountsPerIpPerDay).toBe(5);
    expect(env.requireEmailVerification).toBe(false);
  });

  it('reads the proxy setting as a hop count or as text', () => {
    vi.stubEnv('TRUST_PROXY', '1');
    expect(env.trustProxy).toBe(1);

    vi.stubEnv('TRUST_PROXY', 'loopback');
    expect(env.trustProxy).toBe('loopback');
  });

  it('accepts development defaults outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(productionConfigProblems()).toEqual([]);
  });

  it('lists every unsafe setting in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'change-me-generate-with-openssl-rand-hex-32');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('CORS_ORIGIN', '');
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('SMTP_URL', '');
    expect(productionConfigProblems()).toHaveLength(5);

    vi.stubEnv('JWT_SECRET', 'a'.repeat(64));
    vi.stubEnv('DATABASE_URL', 'postgres://db/edu_desk');
    vi.stubEnv('CORS_ORIGIN', 'https://edudesk.example');
    vi.stubEnv('APP_URL', 'https://edudesk.example');
    vi.stubEnv('SMTP_URL', 'smtps://user:pass@mail.example');
    expect(productionConfigProblems()).toEqual([]);
  });
});
