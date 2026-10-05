import { actionEmail, type EmailLocale } from './layout.js';

type InvitedRole = 'school_admin' | 'teacher' | 'student' | 'parent';

const COPY = {
  en: {
    subject: (school: string) => `You're invited to ${school} on EduDesk`,
    body: (inviter: string, school: string, role: string) => `${inviter} invited you to join ${school} on EduDesk as ${role}.`,
    roles: { school_admin: 'a school admin', teacher: 'a teacher', student: 'a student', parent: 'a parent' },
    next: 'Open the link to create your account, or to add the school to the account you already have.',
    button: 'Accept invitation',
    footer: 'The link works once and expires in 7 days. If you weren’t expecting this, ignore this email.',
  },
  ro: {
    subject: (school: string) => `Ai fost invitat la ${school} pe EduDesk`,
    body: (inviter: string, school: string, role: string) =>
      `${inviter} te-a invitat să te alături școlii ${school} pe EduDesk ca ${role}.`,
    roles: { school_admin: 'administrator', teacher: 'profesor', student: 'elev', parent: 'părinte' },
    next: 'Deschide linkul pentru a-ți crea contul sau pentru a adăuga școala la contul pe care îl ai deja.',
    button: 'Acceptă invitația',
    footer: 'Linkul funcționează o singură dată și expiră în 7 zile. Dacă nu te așteptai la acest email, ignoră-l.',
  },
};

interface InvitationEmail {
  to: string;
  inviter: string;
  school: string;
  role: InvitedRole;
  link: string;
  locale: EmailLocale;
}

export function invitationEmail({ to, inviter, school, role, link, locale }: InvitationEmail) {
  const copy = COPY[locale];
  return actionEmail({
    to,
    subject: copy.subject(school),
    paragraphs: [copy.body(inviter, school, copy.roles[role]), copy.next],
    button: copy.button,
    link,
    footer: copy.footer,
  });
}
