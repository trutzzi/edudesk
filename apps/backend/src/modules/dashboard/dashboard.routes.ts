import express from 'express';
import { authenticateJWT, currentUser, requireRole, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { getStats } from './dashboard.repository.js';

const router = express.Router();

// GET /api/dashboard/stats: a school admin's school, or every school for a super admin
router.get('/stats', authenticateJWT, requireRole('school_admin', 'super_admin'), async (req: AuthenticatedRequest, res) => {
  const schoolId = currentUser(req).role === 'super_admin' ? null : schoolIdOf(req);
  res.json(await getStats(schoolId));
});

export default router;
