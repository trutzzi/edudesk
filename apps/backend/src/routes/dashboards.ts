import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard/stats — for admins: scoped to the caller's school; only super admins see platform-wide totals
router.get('/stats', authenticateJWT, requireRole('school_admin', 'super_admin'), async (req: AuthenticatedRequest, res) => {
  if (!req.user?.schoolId && req.user?.role !== 'super_admin') {
    res.status(403).json({ message: 'Your account is not linked to a school', code: 'NO_SCHOOL' });
    return;
  }

  const { rows } = await pool.query<{ studentsCount: number; teachersCount: number; adminsCount: number; classesCount: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'student')::int      AS "studentsCount",
       COUNT(*) FILTER (WHERE role = 'teacher')::int      AS "teachersCount",
       COUNT(*) FILTER (WHERE role = 'school_admin')::int AS "adminsCount",
       (SELECT COUNT(*)::int FROM classes WHERE $1::uuid IS NULL OR school_id = $1::uuid) AS "classesCount"
     FROM users
     WHERE $1::uuid IS NULL OR school_id = $1::uuid`,
    [req.user?.schoolId ?? null]
  );

  res.json(rows[0]);
});

export default router;
