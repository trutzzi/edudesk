import type { PoolClient } from 'pg';
import { hashPassword } from '../../lib/password.js';
import {
  CLASS_NAME_CANDIDATES,
  CLASSES_TO_ADD,
  emailName,
  PARENT_FIRST_NAMES,
  PERIODS,
  SCHOOL_YEAR,
  STUDENTS,
  TEACHERS,
  UNITS,
  type TeacherKey,
} from './data.js';
import { buildTimetable } from './timetable.js';
import { insertUser } from './users.js';

// Adds teachers, classes, students, parents, courses, a weekly timetable and calendar events to a school
export async function fillSchool(client: PoolClient, schoolId: string, emailDomain: string) {
  const passwordHash = await hashPassword('password123');

  const taken = (await client.query<{ name: string }>('SELECT name FROM classes WHERE school_id = $1', [schoolId])).rows.map(({ name }) =>
    name.toUpperCase(),
  );
  const classNames = CLASS_NAME_CANDIDATES.filter((name) => !taken.includes(name)).slice(0, CLASSES_TO_ADD);
  if (classNames.length < CLASSES_TO_ADD) throw new Error('The school has no free class names left for sample data');

  const teacherIds = {} as Record<TeacherKey, string>;
  for (const [key, [firstName, lastName]] of Object.entries(TEACHERS)) {
    teacherIds[key as TeacherKey] = await insertUser(client, schoolId, passwordHash, {
      firstName,
      lastName,
      email: `${emailName(firstName, lastName)}@${emailDomain}`,
      role: 'teacher',
    });
  }

  // courseIds[classIndex][subject name]
  const courseIds: Record<string, string>[] = [];
  const classIds: string[] = [];

  for (const [classIndex, className] of classNames.entries()) {
    const created = await client.query<{ id: string }>(
      'INSERT INTO classes (school_id, name, school_year) VALUES ($1, $2, $3) RETURNING id',
      [schoolId, className, SCHOOL_YEAR],
    );
    const classId = created.rows[0]!.id;
    classIds.push(classId);

    for (const [studentIndex, fullName] of STUDENTS[classIndex]!.entries()) {
      const [firstName, lastName] = fullName.split(' ') as [string, string];
      const studentId = await insertUser(client, schoolId, passwordHash, {
        firstName,
        lastName,
        email: `${emailName(firstName, lastName, className)}@${emailDomain}`,
        role: 'student',
      });
      await client.query('INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)', [classId, studentId]);

      if (studentIndex === 0) {
        const parentFirstName = PARENT_FIRST_NAMES[classIndex]!;
        const parentId = await insertUser(client, schoolId, passwordHash, {
          firstName: parentFirstName,
          lastName,
          email: `${emailName(parentFirstName, lastName)}@${emailDomain}`,
          role: 'parent',
        });
        await client.query('INSERT INTO parent_student (parent_id, student_id) VALUES ($1, $2)', [parentId, studentId]);
      }
    }

    const ids: Record<string, string> = {};
    for (const subject of UNITS.flatMap((unit) => unit.subjects)) {
      const course = await client.query<{ id: string }>(
        `INSERT INTO courses (class_id, teacher_id, name, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [classId, teacherIds[subject.teacher], subject.name, subject.dates.start, subject.dates.end],
      );
      ids[subject.name] = course.rows[0]!.id;
    }
    courseIds.push(ids);
  }

  // The lessons copy each course's class, teacher and dates, like PUT /api/courses/:id/lessons does,
  // so the database's clash constraints check the generated timetable too
  for (const { classIndex, unitIndex, slot } of buildTimetable(classNames.length)) {
    const [startTime, endTime] = PERIODS[slot.period]!;
    for (const subject of UNITS[unitIndex]!.subjects) {
      await client.query(
        `INSERT INTO lessons (course_id, class_id, teacher_id, start_date, end_date, weekday, start_time, end_time, room)
         SELECT id, class_id, teacher_id, start_date, end_date, $2, $3, $4, $5 FROM courses WHERE id = $1`,
        [courseIds[classIndex]![subject.name], slot.weekday, startTime, endTime, subject.room ?? `Sala ${101 + classIndex}`],
      );
    }
  }

  // The school calendar. School holidays also remove lessons from the timeline and timetables.
  // National public holidays come from data/holidays (npm run holidays), not from here.
  const [first, second, third, fourth] = classIds;
  const events: [string, string, string, string, string | undefined][] = [
    ['Ziua Educației', 'other', '2026-10-05', '2026-10-05', undefined],
    ['Ședință cu părinții', 'meeting', '2026-10-08', '2026-10-08', first],
    ['Teză la matematică', 'exam', '2026-10-14', '2026-10-14', first],
    ['Teză la limba română', 'exam', '2026-10-15', '2026-10-16', second],
    ['Teză la istorie', 'exam', '2026-10-20', '2026-10-20', third],
    ['Excursie la Sibiu', 'trip', '2026-10-21', '2026-10-23', second],
    ['Vizită la Muzeul Satului', 'trip', '2026-11-12', '2026-11-12', fourth],
    ['Vacanța de toamnă', 'holiday', '2026-10-24', '2026-11-01', undefined],
    ['Vacanța de iarnă', 'holiday', '2026-12-19', '2027-01-06', undefined],
  ];
  for (const [title, kind, start, end, classId] of events) {
    await client.query(
      `INSERT INTO school_events (school_id, class_id, title, kind, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, classId ?? null, title, kind, start, end],
    );
  }

  return { classNames };
}
