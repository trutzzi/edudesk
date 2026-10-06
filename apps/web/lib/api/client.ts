// Where the API runs; built into the browser code at build time
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// The API's address for a path, for things the browser loads itself, like an <img>
export const apiUrl = (path: string) => `${API_URL}${path}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Machine-readable reason some errors carry, e.g. "EMAIL_NOT_VERIFIED"
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
}

export async function api<T>(path: string, { body, headers, token, ...init }: RequestOptions = {}): Promise<T> {
  // A file (like a logo) goes as itself, with its own type; anything else as JSON
  const file = typeof Blob !== 'undefined' && body instanceof Blob ? body : null;
  const response = await fetch(apiUrl(path), {
    ...init,
    method: init.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(body !== undefined && { 'Content-Type': file ? file.type : 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : (file ?? JSON.stringify(body)),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data?.message ?? '', response.status, data?.code);
  }

  return data as T;
}

// Error codes the app has its own translated message for
const TRANSLATED_CODES = [
  'RATE_LIMITED',
  'EMAIL_NOT_VERIFIED',
  'INVALID_TOKEN',
  'LESSON_CLASH',
  'SCHOOL_CODE_TAKEN',
  'ALREADY_MEMBER',
  'IN_OTHER_SCHOOL',
  'INVITATION_PENDING',
  'INVALID_INVITATION',
  'WRONG_PASSWORD',
  'TEACHER_HAS_COURSES',
  'CANNOT_REMOVE_SELF',
  'CONTACT_TAKEN',
  'INVALID_PHONE',
  'NOT_A_THERAPY',
  'NOT_SPECIALIZED',
  'FUTURE_SESSION',
  'THERAPY_EXISTS',
  'THERAPY_IN_USE',
  'INVALID_LOGO',
  'TOO_LARGE',
] as const;
type ErrorCode = (typeof TRANSLATED_CODES)[number];
const isTranslatedCode = (code: unknown): code is ErrorCode => TRANSLATED_CODES.includes(code as ErrorCode);

// `t` is the `Errors` translator, so known errors and the fallbacks follow the selected language
export const errorMessage = (err: unknown, t: (key: 'generic' | 'network' | ErrorCode) => string) => {
  if (!(err instanceof ApiError)) return t('network');
  if (isTranslatedCode(err.code)) return t(err.code);
  return err.message || t('generic');
};
