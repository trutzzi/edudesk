import { describe, expect, it } from 'vitest';
import { callHref, WHATSAPP_GREETING, whatsappHref } from './contact';

describe('contact links', () => {
  it('calls the number', () => {
    expect(callHref('+40722123456')).toBe('tel:+40722123456');
  });

  it('opens WhatsApp with the greeting typed in', () => {
    const url = new URL(whatsappHref('+40722123456'));

    expect(url.origin + url.pathname).toBe('https://wa.me/40722123456');
    expect(url.searchParams.get('text')).toBe(WHATSAPP_GREETING);
  });
});
