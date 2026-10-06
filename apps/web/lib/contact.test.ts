import { describe, expect, it } from 'vitest';
import { callHref, whatsappGreeting, whatsappHref } from './contact';

describe('contact links', () => {
  it('calls the number', () => {
    expect(callHref('+40722123456')).toBe('tel:+40722123456');
  });

  it('opens WhatsApp with the greeting typed in', () => {
    const url = new URL(whatsappHref('+40722123456', 'EduDesk'));

    expect(url.origin + url.pathname).toBe('https://wa.me/40722123456');
    expect(url.searchParams.get('text')).toBe('Salutare, vă contactez din partea echipei EduDesk, în legătură cu…');
  });

  it("names the institution's own app when it set one", () => {
    expect(whatsappGreeting('Centrul Alina')).toContain('echipei Centrul Alina,');
  });
});
