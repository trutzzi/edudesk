import express, { type Request, type Response } from 'express';
import { toEmailLocale } from '../../emails/layout.js';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readId, readBody } from '../../http/query.js';
import { isSchoolRole } from '../../lib/roles.js';
import { toSession } from '../../lib/session.js';
import { newLinkToken, sha256 } from '../../lib/tokens.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import {
  deleteInvitation,
  findSchoolOfEmail,
  insertInvitation,
  listForUser,
  listPending,
  lookupByToken,
  renewInvitation,
} from './invitations.repository.js';
import { acceptAsSignedIn, acceptWithLink, invalidInvitation, sendInvitation } from './invitations.service.js';

const router = express.Router();

// Deliberately loose: the real check is whether the person receives the email
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_FOUND = 'Invitation not found';

// --- For the invited person (the routes before manage, so /lookup, /accept and /mine are never read as an id)

// GET /api/invitations/lookup?token=: what the invitation is for, shown before accepting. Signed out.
router.get('/lookup', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!isNonEmptyString(token)) throw invalidInvitation();
  const invitation = await lookupByToken(sha256(token));
  if (!invitation) throw invalidInvitation();
  res.json(invitation);
});

// POST /api/invitations/accept: { token, password, firstName?, lastName? } from the emailed link. Signed out.
router.post('/accept', async (req: Request, res: Response) => {
  const { token, password, firstName, lastName } = readBody(req);
  if (!isNonEmptyString(token)) throw invalidInvitation();
  if (!isNonEmptyString(password)) throw new HttpError(400, 'Password is required');
  res.json(toSession(await acceptWithLink({ token, password, firstName, lastName })));
});

// GET /api/invitations/mine: pending invitations addressed to the signed-in user's email
router.get('/mine', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  res.json(await listForUser(currentUser(req).id));
});

// POST /api/invitations/mine/:id/accept: joins the school from inside the app. Returns a new session,
// because the old token still says "no school".
router.post('/mine/:id/accept', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const invitationId = req.params.id;
  if (!isUuid(invitationId)) throw invalidInvitation();
  res.json(toSession(await acceptAsSignedIn(invitationId, currentUser(req).id)));
});

// --- For admins (every invitation of their school) and teachers (only their own, only students into
// classes they teach)

const manage = express.Router();
manage.use(authenticateJWT, requireRole('school_admin', 'teacher'), requireSchool);

// A teacher's id, to limit invitations to the ones they sent; null for an admin
const sentByLimit = (req: AuthenticatedRequest) => {
  const user = currentUser(req);
  return user.role === 'teacher' ? user.id : null;
};

// GET /api/invitations: invitations not accepted yet
manage.get('/', async (req: AuthenticatedRequest, res) => {
  res.json(await listPending(schoolIdOf(req), sentByLimit(req)));
});

// POST /api/invitations: { email, role, classId? (students), studentId? (parents), locale? }
manage.post('/', async (req: AuthenticatedRequest, res) => {
  const { role, email: rawEmail, classId = null, studentId = null, locale } = readBody(req);
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const schoolId = schoolIdOf(req);

  if (!EMAIL_PATTERN.test(email) || !isSchoolRole(role)) throw new HttpError(400, 'A valid email and role are required');
  if ((classId !== null && (role !== 'student' || !isUuid(classId))) || (studentId !== null && (role !== 'parent' || !isUuid(studentId)))) {
    throw new HttpError(400, 'Only students can be placed in a class, and only parents linked to a child');
  }
  const teacherId = sentByLimit(req);
  if (teacherId && (role !== 'student' || classId === null)) {
    throw new HttpError(403, 'Teachers can invite students into the classes they teach', 'TEACHERS_INVITE_STUDENTS');
  }

  const memberOf = await findSchoolOfEmail(email);
  if (memberOf === schoolId) throw new HttpError(409, 'This person is already in your school', 'ALREADY_MEMBER');
  if (memberOf) throw new HttpError(409, 'This person belongs to another school', 'IN_OTHER_SCHOOL');

  const { token, hash } = newLinkToken();
  const inviterId = currentUser(req).id;
  const id = await insertInvitation({ schoolId, email, role, classId, studentId, tokenHash: hash, invitedBy: inviterId, teacherId }).catch(
    (err) => {
      if (isPgError(err, PG_ERRORS.uniqueViolation)) {
        throw new HttpError(409, 'This person already has a pending invitation. Resend it instead.', 'INVITATION_PENDING');
      }
      throw err;
    },
  );
  if (!id) throw new HttpError(404, teacherId ? 'You do not teach this class' : 'Class or student not found in your school');

  await sendInvitation({ email, role }, token, inviterId, toEmailLocale(locale));
  res.status(201).json({ id, email, role });
});

// POST /api/invitations/:id/resend: a new link and a fresh expiry; the old link stops working
manage.post('/:id/resend', async (req: AuthenticatedRequest, res) => {
  const invitationId = readId(req.params.id, NOT_FOUND);
  const { token, hash } = newLinkToken();
  const invitation = await renewInvitation(invitationId, schoolIdOf(req), hash, sentByLimit(req));
  if (!invitation) throw new HttpError(404, NOT_FOUND);

  await sendInvitation(invitation, token, currentUser(req).id, toEmailLocale(readBody(req).locale));
  res.status(204).end();
});

// DELETE /api/invitations/:id: revokes a pending invitation
manage.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const invitationId = readId(req.params.id, NOT_FOUND);
  if (!(await deleteInvitation(invitationId, schoolIdOf(req), sentByLimit(req)))) throw new HttpError(404, NOT_FOUND);
  res.status(204).end();
});

router.use(manage);

export default router;
