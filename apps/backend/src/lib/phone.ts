// A phone number as entered ("0722 123 456", "+40 722-123-456", "0040722123456") in one international
// form, "+40722123456", so the same number always matches and WhatsApp links work. A national number
// starting with 0 is taken as Romanian. Returns null for anything that isn't a phone number.
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let phone = value.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  else if (/^0\d{9}$/.test(phone)) phone = `+40${phone.slice(1)}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
