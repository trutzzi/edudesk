// An easy password for the admin to read out or write down: lowercase letters and digits, without the ones people
// misread (0/o, 1/l/i). The backend's create-admin script uses the same alphabet.
export const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const EASY_PASSWORD_LENGTH = 6;

export function generatePassword(length = EASY_PASSWORD_LENGTH) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('');
}
