import type { Mail } from './mailer.js';

export type EmailLocale = 'en' | 'ro';

export const toEmailLocale = (value: unknown): EmailLocale => (value === 'ro' ? 'ro' : 'en');

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

interface ActionEmail {
  to: string;
  subject: string;
  // Plain text; escaped for the HTML version
  paragraphs: string[];
  button: string;
  link: string;
  footer: string;
}

// The one email shape the app sends: a few paragraphs, a button, and a small print footer.
// Every email has a plain-text version too, for clients that don't show HTML.
export function actionEmail({ to, subject, paragraphs, button, link, footer }: ActionEmail): Mail {
  return {
    to,
    subject,
    text: [...paragraphs, link, footer].join('\n\n'),
    html: [
      ...paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`),
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(button)}</a></p>`,
      `<p style="color:#64748b;font-size:13px">${escapeHtml(footer)}</p>`,
    ].join('\n'),
  };
}
