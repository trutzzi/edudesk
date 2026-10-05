import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transport: Transporter | null | undefined;

// SMTP_URL looks like smtps://user:password@smtp.example.com:465. Without it (local development),
// emails are printed to the console instead, so you can copy the link from the terminal.
function getTransport() {
  if (transport === undefined) {
    transport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null;
  }
  return transport;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(mail: Mail) {
  const smtp = getTransport();
  if (!smtp) {
    console.info(`\n[mail] To: ${mail.to}\n[mail] Subject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await smtp.sendMail({ from: env.mailFrom, ...mail });
}
