import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readId } from '../../http/query.js';
import { isSchoolRole } from '../../lib/roles.js';
import { countTaughtCourses, listMembers, lockMember, unlinkFromSchool } from './users.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireRole('school_admin'), requireSchool);

const NOT_FOUND = 'Person not found in your school';

// GET /api/users?role=teacher: people in the school; without ?role, everyone
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { role } = req.query;
  if (role !== undefined && !isSchoolRole(role)) throw new HttpError(400, 'role must be teacher, student, parent or school_admin');
  res.json(await listMembers(schoolIdOf(req), role ?? null));
});

// DELETE /api/users/:id: removes someone from the school. The account stays, unlinked, so they can still
// sign in and be invited again.
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = readId(req.params.id, NOT_FOUND);
  if (userId === currentUser(req).id) throw new HttpError(400, "You can't remove yourself from the school", 'CANNOT_REMOVE_SELF');
  const schoolId = schoolIdOf(req);

  await withTransaction(async (client) => {
    if (!(await lockMember(client, userId, schoolId))) throw new HttpError(404, NOT_FOUND);

    // A course needs its teacher, so the school decides what happens to the courses first
    const courses = await countTaughtCourses(client, userId);
    if (courses > 0) {
      throw new HttpError(409, `This teacher still teaches ${courses} courses. Delete or reassign them first.`, 'TEACHER_HAS_COURSES');
    }
    await unlinkFromSchool(client, userId);
  });

  res.status(204).end();
});

export default router;
