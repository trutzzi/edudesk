import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../utils/transaction.js';
import { isUuid } from '../utils/validation.js';

const router = express.Router();

router.use(authenticateJWT, requireRole('school_admin'), requireSchool);

const LISTABLE_ROLES = new Set(['teacher', 'student', 'parent', 'school_admin']);

// GET /api/users?role=teacher — people in the caller's school; without ?role, everyone
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { role } = req.query;
  if (role !== undefined && (typeof role !== 'string' || !LISTABLE_ROLES.has(role))) {
    throw new HttpError(400, 'role must be teacher, student, parent or school_admin');
  }

  const { rows } = await pool.query(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", email, role
     FROM users
     WHERE school_id = $1 AND ($2::user_role IS NULL OR role = $2::user_role)
     ORDER BY last_name, first_name`,
    [req.user!.schoolId, role ?? null]
  );
  res.json(rows);
});

// DELETE /api/users/:id — removes someone from the school. The account itself stays, unlinked, so the
// person can still sign in and be invited again. Their class places and parent links go.
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.params.id;
  if (!isUuid(userId)) throw new HttpError(404, 'Person not found in your school');
  if (userId === req.user!.id) throw new HttpError(400, "You can't remove yourself from the school", 'CANNOT_REMOVE_SELF');

  await withTransaction(async (client) => {
    const member = (
      await client.query<{ role: string }>('SELECT role FROM users WHERE id = $1 AND school_id = $2 FOR UPDATE', [
        userId,
        req.user!.schoolId,
      ])
    ).rows[0];
    if (!member) throw new HttpError(404, 'Person not found in your school');

    // A course needs its teacher, so the school decides what happens to them first
    const courses = await client.query('SELECT 1 FROM courses WHERE teacher_id = $1', [userId]);
    if (courses.rowCount) {
      throw new HttpError(
        409,
        `This teacher still teaches ${courses.rowCount} courses. Delete or reassign them first.`,
        'TEACHER_HAS_COURSES'
      );
    }

    await client.query('DELETE FROM class_students WHERE student_id = $1', [userId]);
    await client.query('DELETE FROM parent_student WHERE parent_id = $1 OR student_id = $1', [userId]);
    await client.query('UPDATE users SET school_id = NULL WHERE id = $1', [userId]);
  });

  res.status(204).end();
});

export default router;
