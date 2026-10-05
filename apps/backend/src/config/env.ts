// Every setting the API reads from the environment, in one place. Values are read when used,
// so tests can change them; see .env.example for what each one means.

const DEFAULT_WEB_URL = 'http://localhost:3000';

export const env = {
  get port() {
    return Number(process.env.PORT) || 4000;
  },
  get databaseUrl() {
    return process.env.DATABASE_URL;
  },
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set');
    return secret;
  },
  get corsOrigin() {
    return process.env.CORS_ORIGIN ?? DEFAULT_WEB_URL;
  },
  // Where links in emails point
  get appUrl() {
    return process.env.APP_URL ?? process.env.CORS_ORIGIN ?? DEFAULT_WEB_URL;
  },
  get smtpUrl() {
    return process.env.SMTP_URL || undefined;
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? 'EduDesk <no-reply@edudesk.local>';
  },
  // Schools often share one public IP, so this stays generous
  get maxAccountsPerIpPerDay() {
    return Number(process.env.MAX_ACCOUNTS_PER_IP_PER_DAY) || 5;
  },
  // Number of proxy hops in front of the API, or Express's own trust proxy setting; unset means none
  get trustProxy(): number | string | undefined {
    const value = process.env.TRUST_PROXY;
    return value ? Number(value) || value : undefined;
  },
  get requireEmailVerification() {
    return process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? 'development';
  },
};

const MIN_JWT_SECRET_LENGTH = 32;

// Settings that have a development default but must be set on purpose in production.
// Returns what is wrong, so the server can refuse to start instead of running insecurely.
export const productionConfigProblems = (): string[] => {
  if (env.nodeEnv !== 'production') return [];
  const problems: string[] = [];
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < MIN_JWT_SECRET_LENGTH || secret.startsWith('change-me')) {
    problems.push(`JWT_SECRET must be a random value of at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  if (!process.env.CORS_ORIGIN) problems.push('CORS_ORIGIN is not set');
  if (!process.env.APP_URL) problems.push('APP_URL is not set');
  if (!process.env.SMTP_URL) problems.push('SMTP_URL is not set, so emails would only be printed to the console');
  return problems;
};
