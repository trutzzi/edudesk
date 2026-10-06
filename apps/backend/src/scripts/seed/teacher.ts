import { withTransaction } from '../../db/transaction.js';
import { hashPassword } from '../../lib/password.js';
import { emailName, EXTRA_COURSES, samplePassword, PERIODS, TEACHER_CLASS_STUDENTS, WEEKDAYS, YEAR } from './data.js';
import { freePeriods } from './timetable.js';
import { addSpecialization, insertUser } from './users.js';

export async function seedTeacher(email: string) {
  await withTransaction(async (client) => {
    const teacher = (
      await client.query<{ id: string; school_id: string | null; code: string }>(
        `SELECT u.id, u.school_id, s.code FROM users u LEFT JOIN schools s ON s.id = u.school_id
         WHERE lower(u.email) = lower($1) AND u.role = 'teacher'`,
        [email],
      )
    ).rows[0];
    if (!teacher) throw new Error(`No teacher has the email ${email}`);
    if (!teacher.school_id) throw new Error(`${email} isn't in a school yet`);

    const emailDomain = `${emailName(teacher.code)}.edudesk.test`;
    const passwordHash = await hashPassword(samplePassword());
    const added: string[] = [];

    // 1. Students for the teacher's classes that have none
    const emptyClasses = (
      await client.query<{ id: string; name: string }>(
        `SELECT c.id, c.name FROM classes c
         WHERE EXISTS (SELECT 1 FROM courses co WHERE co.class_id = c.id AND co.teacher_id = $1)
           AND NOT EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = c.id)
         ORDER BY length(c.name), c.name`,
        [teacher.id],
      )
    ).rows;
    for (const [classIndex, schoolClass] of emptyClasses.entries()) {
      const names = TEACHER_CLASS_STUDENTS[classIndex % TEACHER_CLASS_STUDENTS.length]!;
      for (const fullName of names) {
        const [firstName, lastName] = fullName.split(' ') as [string, string];
        const studentId = await insertUser(client, teacher.school_id, passwordHash, {
          firstName,
          lastName,
          email: `${emailName(firstName, lastName, schoolClass.name)}@${emailDomain}`,
          role: 'student',
          paymentType: 'cas',
        });
        await client.query('INSERT INTO class_students (class_id, student_id, joined_at) VALUES ($1, $2, $3)', [
          schoolClass.id,
          studentId,
          YEAR.start,
        ]);
      }
      added.push(`7 students in ${schoolClass.name}`);
    }

    // 2. More courses, in classes with students that the teacher doesn't teach yet, in slots free for both.
    //    Skipped once the teacher has any of them, so a second run doesn't pick yet more classes.
    const extraCourseNames = EXTRA_COURSES.map(({ name }) => name);
    const hasExtraCourses = Boolean(
      (await client.query('SELECT 1 FROM courses WHERE teacher_id = $1 AND name = ANY($2::text[])', [teacher.id, extraCourseNames]))
        .rowCount,
    );
    const otherClasses = hasExtraCourses
      ? []
      : (
          await client.query<{ id: string; name: string }>(
            `SELECT c.id, c.name FROM classes c
             WHERE c.school_id = $1
               AND EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = c.id)
               AND NOT EXISTS (SELECT 1 FROM courses co WHERE co.class_id = c.id AND co.teacher_id = $2)
             ORDER BY length(c.name), c.name
             LIMIT $3`,
            [teacher.school_id, teacher.id, EXTRA_COURSES.length],
          )
        ).rows;
    const busyOf = async (column: 'teacher_id' | 'class_id', id: string) =>
      (
        await client.query<{ weekday: number; start_time: string; end_time: string }>(
          `SELECT weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
           FROM lessons WHERE ${column} = $1`,
          [id],
        )
      ).rows;

    for (const [index, schoolClass] of otherClasses.entries()) {
      const { name, hoursPerWeek } = EXTRA_COURSES[index]!;
      const course = await client.query<{ id: string }>(
        `INSERT INTO courses (class_id, teacher_id, name, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (class_id, name) DO NOTHING
         RETURNING id`,
        [schoolClass.id, teacher.id, name, YEAR.start, YEAR.end],
      );
      const courseId = course.rows[0]?.id;
      if (!courseId) continue;
      await addSpecialization(client, teacher.id, name);

      // One hour per day, on the first free period both the class and the teacher have
      let placed = 0;
      for (let weekday = 1; weekday <= WEEKDAYS && placed < hoursPerWeek; weekday++) {
        const busy = [...(await busyOf('teacher_id', teacher.id)), ...(await busyOf('class_id', schoolClass.id))];
        const period = freePeriods(busy, weekday)[0];
        if (period === undefined) continue;
        const [startTime, endTime] = PERIODS[period]!;
        await client.query(
          `INSERT INTO lessons (course_id, class_id, teacher_id, start_date, end_date, weekday, start_time, end_time, room)
           SELECT id, class_id, teacher_id, start_date, end_date, $2, $3, $4, $5 FROM courses WHERE id = $1`,
          [courseId, weekday, startTime, endTime, null],
        );
        placed++;
      }
      added.push(`${name} in ${schoolClass.name} (${placed} a week)`);
    }

    // 3. A parents' meeting for each class the teacher teaches
    const meetings = await client.query(
      `INSERT INTO school_events (school_id, class_id, title, kind, start_date, end_date, created_by)
       SELECT c.school_id, c.id, 'Ședință cu părinții ' || c.name, 'meeting', '2026-10-13', '2026-10-13', $1
       FROM classes c
       WHERE EXISTS (SELECT 1 FROM courses co WHERE co.class_id = c.id AND co.teacher_id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM school_events e WHERE e.class_id = c.id AND e.title = 'Ședință cu părinții ' || c.name)`,
      [teacher.id],
    );
    if (meetings.rowCount) added.push(`${meetings.rowCount} parents' meetings on 13 Oct`);

    console.log(added.length ? `Added for ${email}: ${added.join('; ')}.` : `${email} already has sample data.`);
  });
}
