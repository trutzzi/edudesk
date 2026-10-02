import { actionEmail, type EmailLocale } from './layout.js';

const COPY = {
  en: {
    subject: 'Confirm your EduDesk account',
    greeting: (name: string) => `Hi ${name},`,
    body: 'Confirm your email address to finish creating your EduDesk account.',
    button: 'Confirm email',
    footer: 'The link works once and expires in 24 hours. If you did not create this account, ignore this email.',
  },
  ro: {
    subject: 'Confirmă-ți contul EduDesk',
    greeting: (name: string) => `Bună, ${name},`,
    body: 'Confirmă-ți adresa de email pentru a finaliza crearea contului EduDesk.',
    button: 'Confirmă emailul',
    footer: 'Linkul funcționează o singură dată și expiră în 24 de ore. Dacă nu tu ai creat acest cont, ignoră acest email.',
  },
};

export function verificationEmail(to: string, firstName: string, link: string, locale: EmailLocale) {
  const copy = COPY[locale];
  return actionEmail({
    to,
    subject: copy.subject,
    paragraphs: [copy.greeting(firstName), copy.body],
    button: copy.button,
    link,
    footer: copy.footer,
  });
}
