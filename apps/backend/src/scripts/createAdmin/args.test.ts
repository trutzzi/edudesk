import { describe, expect, it } from 'vitest';
import { parseAdminArgs } from './args.js';

const valid = ['--code', 'blue', '--institution', 'Centrul Blue', '--first', 'Ana', '--last', 'Pop', '--email', 'Ana@Blue.ro'];

describe('parseAdminArgs', () => {
  it('reads the institution and the admin', () => {
    expect(parseAdminArgs(valid)).toEqual({
      code: 'BLUE',
      institution: 'Centrul Blue',
      firstName: 'Ana',
      lastName: 'Pop',
      email: 'ana@blue.ro',
      phone: null,
      appName: null,
      color: null,
    });
  });

  it('takes the app name and color', () => {
    expect(parseAdminArgs([...valid, '--app-name', 'Centrul Blue', '--color', '#0EA5E9'])).toMatchObject({
      appName: 'Centrul Blue',
      color: '#0ea5e9',
    });
  });

  it('takes a phone instead of an email', () => {
    expect(parseAdminArgs(['--code', 'BLUE', '--first', 'Ana', '--last', 'Pop', '--phone', '0722 111 222']).phone).toBe('+40722111222');
  });

  it.each([
    ['no way to sign in', ['--code', 'BLUE', '--first', 'Ana', '--last', 'Pop'], /--email or a --phone/],
    ['a bad code', ['--code', 'B', '--first', 'Ana', '--last', 'Pop', '--email', 'a@b.ro'], /--code/],
    ['a missing name', ['--code', 'BLUE', '--first', 'Ana', '--email', 'a@b.ro'], /--first and --last/],
    ['a bad phone', ['--code', 'BLUE', '--first', 'Ana', '--last', 'Pop', '--phone', '12'], /not a phone/],
    ['a flag without a value', ['--code', 'BLUE', '--first'], /--first needs a value/],
    ['an unknown flag', [...valid, '--role', 'teacher'], /Unknown option --role/],
    ['a bad color', [...valid, '--color', 'blue'], /--color/],
  ])('rejects %s', (_case, argv, message) => {
    expect(() => parseAdminArgs(argv)).toThrow(message);
  });
});
