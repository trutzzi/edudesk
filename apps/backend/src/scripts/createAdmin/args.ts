import { normalizePhone } from '../../lib/phone.js';

export const USAGE = `Usage: npm run create-admin -- --code <CODE> [--institution "<name>"] --first <first name> --last <last name>
                            (--email <email> | --phone <phone>) [--email … --phone …]

  --code         The institution's code, 3–20 letters, digits or dashes. If no institution has it yet,
                 one is created, and --institution names it.
  --institution  The new institution's name.
  --app-name     What the app is called for its people, in place of "EduDesk" (optional).
  --color        Its main color, like #0ea5e9 (optional). The logo is uploaded later, under Instituție.
  Set ADMIN_PASSWORD to choose the password; otherwise a strong one is generated and shown once.`;

export const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_ADMIN_PASSWORD_LENGTH = 8;

export interface AdminArgs {
  code: string;
  institution: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  appName: string | null;
  color: string | null;
}

// Reads "--flag value" pairs; anything wrong throws with a message saying what
export function parseAdminArgs(argv: string[]): AdminArgs {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!;
    const value = argv[i + 1];
    if (!flag.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    values.set(flag.slice(2), value.trim());
  }
  const known = ['code', 'institution', 'first', 'last', 'email', 'phone', 'app-name', 'color'];
  const unknown = [...values.keys()].find((key) => !known.includes(key));
  if (unknown) throw new Error(`Unknown option --${unknown}`);

  const code = (values.get('code') ?? '').toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new Error('--code must be 3–20 letters, digits or dashes');
  const firstName = values.get('first');
  const lastName = values.get('last');
  if (!firstName || !lastName) throw new Error('--first and --last are required');

  const email = values.get('email')?.toLowerCase() || null;
  if (email && !EMAIL_PATTERN.test(email)) throw new Error(`${email} is not an email address`);
  const rawPhone = values.get('phone');
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) throw new Error(`${rawPhone} is not a phone number`);
  if (!email && !phone) throw new Error('Give an --email or a --phone to sign in with');

  const color = values.get('color')?.toLowerCase() || null;
  if (color && !/^#[0-9a-f]{6}$/.test(color)) throw new Error('--color must look like #0ea5e9');

  return {
    code,
    institution: values.get('institution') || null,
    firstName,
    lastName,
    email,
    phone,
    appName: values.get('app-name') || null,
    color,
  };
}
