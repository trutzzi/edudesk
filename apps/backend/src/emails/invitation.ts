import { actionEmail, type EmailLocale } from './layout.js';

type InvitedRole = 'school_admin' | 'teacher' | 'student' | 'parent';

const COPY = {
  en: {
    subject: (school: string, app: string) => `You're invited to ${school} on ${app}`,
    body: (inviter: string, school: string, role: string, app: string) => `${inviter} invited you to join ${school} on ${app} as ${role}.`,
    roles: { school_admin: 'an institution admin', teacher: 'a therapist', student: 'a patient/client', parent: 'a parent' },
    next: 'Open the link to create your account, or to add the institution to the account you already have.',
    button: 'Accept invitation',
    footer: 'The link works once and expires in 7 days. If you weren’t expecting this, ignore this email.',
  },
  ro: {
    subject: (school: string, app: string) => `Ai fost invitat la ${school} pe ${app}`,
    body: (inviter: string, school: string, role: string, app: string) =>
      `${inviter} te-a invitat să te alături instituției ${school} pe ${app} ca ${role}.`,
    roles: { school_admin: 'administrator', teacher: 'terapeut', student: 'pacient/client', parent: 'părinte' },
    next: 'Deschide linkul pentru a-ți crea contul sau pentru a adăuga instituția la contul pe care îl ai deja.',
    button: 'Acceptă invitația',
    footer: 'Linkul funcționează o singură dată și expiră în 7 zile. Dacă nu te așteptai la acest email, ignoră-l.',
  },
};

interface InvitationEmail {
  to: string;
  inviter: string;
  school: string;
  // The institution's own name for the app, when it set one
  appName?: string | null;
  role: InvitedRole;
  link: string;
  locale: EmailLocale;
}

const DEFAULT_APP_NAME = 'Blue';

export function invitationEmail({ to, inviter, school, appName, role, link, locale }: InvitationEmail) {
  const copy = COPY[locale];
  const app = appName ?? DEFAULT_APP_NAME;
  return actionEmail({
    to,
    subject: copy.subject(school, app),
    paragraphs: [copy.body(inviter, school, copy.roles[role], app), copy.next],
    button: copy.button,
    link,
    footer: copy.footer,
  });
}
