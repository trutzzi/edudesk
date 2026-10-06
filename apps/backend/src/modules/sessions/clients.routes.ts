import express from 'express';
import { authenticateJWT, currentUser, requireRole, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readDateRange, readId } from '../../http/query.js';
import { findVisibleClient, listTherapistClients, schoolToday, sessionsBetween } from './sessions.repository.js';

const router = express.Router();
router.use(authenticateJWT);

const NOT_FOUND = 'Client not found';
// Two months of history per request
const MAX_HISTORY_DAYS = 62;

// GET /api/clients: a therapist's clients, from every room they work in
router.get('/', requireRole('teacher'), async (req: AuthenticatedRequest, res) => {
  res.json(await listTherapistClients(currentUser(req).id));
});

async function visibleClient(req: AuthenticatedRequest) {
  const client = await findVisibleClient(readId(req.params.id, NOT_FOUND), currentUser(req));
  if (!client) throw new HttpError(404, NOT_FOUND);
  return client;
}

// GET /api/clients/:id: the client card, for admins, the client's therapists, and the client themselves.
// How the therapy is paid for is for staff only.
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const client = await visibleClient(req);
  res.json(currentUser(req).role === 'student' ? { ...client, paymentType: null } : client);
});

// GET /api/clients/:id/sessions?from&to: the client's sessions up to today, with their attendance
router.get('/:id/sessions', async (req: AuthenticatedRequest, res) => {
  const client = await visibleClient(req);
  const { from, to } = readDateRange(req.query, MAX_HISTORY_DAYS);
  const user = currentUser(req);
  if (!user.schoolId) throw new HttpError(404, NOT_FOUND);

  const today = await schoolToday(user.schoolId);
  const until = to < today ? to : today;
  res.json(from > until ? [] : await sessionsBetween(from, until, 'client', client.id));
});

export default router;
