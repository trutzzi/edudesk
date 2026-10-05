import { withTransaction } from '../../db/transaction.js';
import { invitationEmail } from '../../emails/invitation.js';
import type { EmailLocale } from '../../emails/layout.js';
import { sendMail } from '../../emails/mailer.js';
import { HttpError } from '../../http/errors.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import type { SchoolRole } from '../../lib/roles.js';
import { appLink, sha256 } from '../../lib/tokens.js';
import { isNonEmptyString } from '../../lib/validation.js';
import { emailVerificationRequired } from '../auth/verification.js';
import type { UserRow } from '../users/users.repository.js';
import {
  completeInvitation,
  findInviter,
  insertInvitedUser,
  joinSchool,
  lockPendingByToken,
  lockPendingForEmail,
  lockUserByEmail,
  lockUserById,
  type InvitationRow,
} from './invitations.repository.js';

const MIN_PASSWORD_LENGTH = 8;

export const invalidInvitation = () => new HttpError(404, 'This invitation is invalid, already used or expired', 'INVALID_INVITATION');

// Sends (or re-sends) an invitation email. A failed send is logged, not fatal: it can be resent.
export async function sendInvitation(
  invitation: { email: string; role: SchoolRole },
  token: string,
  inviterId: string,
  locale: EmailLocale,
) {
  const { inviter, school } = await findInviter(inviterId);
  try {
    await sendMail(
      invitationEmail({ to: invitation.email, inviter, school, role: invitation.role, link: appLink('/invite', token), locale }),
    );
  } catch (err) {
    console.error(`Could not send the invitation to ${invitation.email}:`, err);
  }
}

// An existing account can join unless it belongs to another school (or runs the platform)
function assertCanJoin(account: UserRow, invitation: InvitationRow) {
  if (account.role === 'super_admin' || (account.school_id && account.school_id !== invitation.school_id)) {
    throw new HttpError(409, 'This account belongs to another school', 'IN_OTHER_SCHOOL');
  }
}

interface LinkAcceptance {
  token: string;
  password: string;
  // Only needed when the invited email has no account yet
  firstName?: unknown;
  lastName?: unknown;
}

// Accepting from the emailed link: a new person creates their account, someone with an account confirms
// it with their password. Either way they join the school with the invited role.
export function acceptWithLink({ token, password, firstName, lastName }: LinkAcceptance) {
  return withTransaction(async (client) => {
    const invitation = await lockPendingByToken(client, sha256(token));
    if (!invitation) throw invalidInvitation();

    const existing = await lockUserByEmail(client, invitation.email);
    let member: UserRow;
    if (existing) {
      if (!(await comparePassword(password, existing.password_hash))) {
        throw new HttpError(401, 'Wrong password for this account', 'WRONG_PASSWORD');
      }
      assertCanJoin(existing, invitation);
      // Opening the emailed link proves the address
      member = await joinSchool(client, existing.id, invitation, true);
    } else {
      if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName)) {
        throw new HttpError(400, 'First name and last name are required');
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      member = await insertInvitedUser(client, invitation, {
        passwordHash: await hashPassword(password),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    }

    await completeInvitation(client, invitation, member.id);
    return member;
  });
}

// Accepting from inside the app: being signed in as the invited email is the proof
export function acceptAsSignedIn(invitationId: string, userId: string) {
  return withTransaction(async (client) => {
    const account = await lockUserById(client, userId);
    if (!account) throw new HttpError(401, 'Session expired, please sign in again');
    // With verification on, only an address the person has shown they own can collect its invitations
    if (emailVerificationRequired() && !account.email_verified_at) {
      throw new HttpError(403, 'Confirm your email before accepting invitations', 'EMAIL_NOT_VERIFIED');
    }

    const invitation = await lockPendingForEmail(client, invitationId, account.email);
    if (!invitation) throw invalidInvitation();

    assertCanJoin(account, invitation);
    const member = await joinSchool(client, account.id, invitation, false);
    await completeInvitation(client, invitation, member.id);
    return member;
  });
}
