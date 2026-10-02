// Sample data for trying the app. Every account it creates has the password "password123".
//
//   npm run seed                       creates the demo school (code DEMO) with its admin, admin@demo.edu
//   npm run seed -- --reset            deletes the demo school and creates it again
//   npm run seed -- --school <CODE>    adds the same kind of data to an existing school, e.g. your own.
//                                      It only adds: new classes get names the school doesn't use yet.
//   npm run seed -- --teacher <EMAIL>  fills in around an existing teacher: students for their empty
//                                      classes, two more courses in free slots, and parents' meetings.
import 'dotenv/config';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { hashPassword } from './utils/auth.js';
import { withTransaction } from './utils/transaction.js';

const DEMO_CODE = 'DEMO';
const SCHOOL_YEAR = '2026-2027';
const CLASS_NAME_CANDIDATES = ['9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'];
const CLASSES_TO_ADD = 4;

// Demo dates for 2026-2027: the full year, two semesters and a short optional module
const YEAR = { start: '2026-09-07', end: '2027-06-18' };
const SEMESTER_1 = { start: '2026-09-07', end: '2027-01-29' };
const SEMESTER_2 = { start: '2027-02-08', end: '2027-06-18' };
const MODULE = { start: '2026-10-05', end: '2026-12-18' };

const TEACHERS = {
  elena: ['Elena', 'Popescu'],
  mihai: ['Mihai', 'Ionescu'],
  sarah: ['Sarah', 'Miller'],
  andrei: ['Andrei', 'Vasile'],
  ioana: ['Ioana', 'Radu'],
  dan: ['Dan', 'Stoica'],
} as const;
type TeacherKey = keyof typeof TEACHERS;

interface Subject {
  name: string;
  teacher: TeacherKey;
  dates: { start: string; end: string };
  room?: string;
}

// What every class studies. Subjects in one unit share the same weekly slots: Physics runs in the
// first semester and Chemistry in the second, in the same hours, which the clash rules allow.
const UNITS: { subjects: Subject[]; hoursPerWeek: number }[] = [
  { subjects: [{ name: 'Matematică', teacher: 'elena', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'Limba română', teacher: 'mihai', dates: YEAR }], hoursPerWeek: 4 },
  { subjects: [{ name: 'English', teacher: 'sarah', dates: YEAR }], hoursPerWeek: 3 },
  {
    subjects: [
      { name: 'Fizică', teacher: 'andrei', dates: SEMESTER_1, room: 'Laborator' },
      { name: 'Chimie', teacher: 'andrei', dates: SEMESTER_2, room: 'Laborator' },
    ],
    hoursPerWeek: 2,
  },
  { subjects: [{ name: 'Istorie', teacher: 'ioana', dates: YEAR }], hoursPerWeek: 2 },
  { subjects: [{ name: 'Informatică', teacher: 'dan', dates: YEAR, room: 'Sala IT' }], hoursPerWeek: 2 },
  { subjects: [{ name: 'Robotică', teacher: 'sarah', dates: MODULE, room: 'Sala IT' }], hoursPerWeek: 1 },
];

const PERIODS = [
  ['08:00', '08:50'],
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['11:00', '11:50'],
  ['12:00', '12:50'],
  ['13:00', '13:50'],
] as const;
const WEEKDAYS = 5;

// Seven students for each class added, in order
const STUDENTS = [
  ['Andrei Dumitru', 'Ioana Stan', 'Radu Marin', 'Maria Gheorghe', 'Ștefan Popa', 'Elena Nistor', 'Matei Oprea'],
  ['Alexandru Rusu', 'Ana Matei', 'David Constantin', 'Carla Neagu', 'Victor Sima', 'Larisa Petcu', 'Eric Toma'],
  ['Daria Lungu', 'Vlad Ciobanu', 'Bianca Tudor', 'Tudor Iordache', 'Sara Munteanu', 'Luca Barbu', 'Irina Moldovan'],
  ['Mihnea Florea', 'Alexia Pavel', 'Robert Stoica', 'Teodora Ene', 'Gabriel Dinu', 'Ana-Maria Voicu', 'Cosmin Lazăr'],
];
// The first student of each class gets a parent account, with these first names
const PARENT_FIRST_NAMES = ['Cristina', 'Adrian', 'Monica', 'Florin'];

// "Ana-Maria Voicu" → "ana-maria.voicu": email addresses don't do diacritics
const emailName = (...parts: string[]) =>
  parts
    .join('.')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '.')
    .toLowerCase();

interface Slot {
  weekday: number;
  period: number;
}

// Places every unit's weekly hours for every class so that no teacher and no class is booked twice
// at the same time. Greedy, with each class and unit starting from a different slot so the week fills
// evenly; a unit's hours go on different days where possible.
function buildTimetable(classCount: number) {
  const teacherBusy = new Set<string>();
  const timetable: { classIndex: number; unitIndex: number; slot: Slot }[] = [];
  const slotCount = WEEKDAYS * PERIODS.length;

  for (let classIndex = 0; classIndex < classCount; classIndex++) {
    const classBusy = new Set<string>();

    UNITS.forEach((unit, unitIndex) => {
      const teachers = [...new Set(unit.subjects.map((subject) => subject.teacher))];
      const offset = classIndex * 7 + unitIndex * 11;
      const daysUsed = new Set<number>();
      let placed = 0;

      // First try one hour per day, then allow doubling up on a day
      for (const spreadAcrossDays of [true, false]) {
        for (let i = 0; i < slotCount && placed < unit.hoursPerWeek; i++) {
          const index = (offset + i) % slotCount;
          const slot = { weekday: (index % WEEKDAYS) + 1, period: Math.floor(index / WEEKDAYS) };
          const key = `${slot.weekday}-${slot.period}`;
          if (classBusy.has(key) || (spreadAcrossDays && daysUsed.has(slot.weekday))) continue;
          if (teachers.some((teacher) => teacherBusy.has(`${teacher}-${key}`))) continue;

          classBusy.add(key);
          teachers.forEach((teacher) => teacherBusy.add(`${teacher}-${key}`));
          daysUsed.add(slot.weekday);
          timetable.push({ classIndex, unitIndex, slot });
          placed++;
        }
      }
      if (placed < unit.hoursPerWeek) {
        throw new Error(`Could not fit ${unit.subjects[0]!.name} into the timetable of class ${classIndex + 1}`);
      }
    });
  }
  return timetable;
}

async function insertUser(
  client: PoolClient,
  schoolId: string,
  passwordHash: string,
  user: { firstName: string; lastName: string; email: string; role: string }
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (school_id, email, password_hash, first_name, last_name, role, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id`,
    [schoolId, user.email, passwordHash, user.firstName, user.lastName, user.role]
  );
  return rows[0]!.id;
}

// Adds teachers, classes, students, parents, courses, a weekly timetable and calendar events to a school
async function fillSchool(client: PoolClient, schoolId: string, emailDomain: string) {
  const passwordHash = await hashPassword('password123');

  const taken = (await client.query<{ name: string }>('SELECT name FROM classes WHERE school_id = $1', [schoolId])).rows.map(
    ({ name }) => name.toUpperCase()
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
      [schoolId, className, SCHOOL_YEAR]
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
        [classId, teacherIds[subject.teacher], subject.name, subject.dates.start, subject.dates.end]
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
        [courseIds[classIndex]![subject.name], slot.weekday, startTime, endTime, subject.room ?? `Sala ${101 + classIndex}`]
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
      [schoolId, classId ?? null, title, kind, start, end]
    );
  }

  return { classNames };
}

async function seedDemoSchool(reset: boolean) {
  await withTransaction(async (client) => {
    if (reset) {
      // Accounts that aren't demo accounts (like your own, linked to the demo school) are kept, just unlinked
      await client.query(
        `UPDATE users SET school_id = NULL
         WHERE email NOT LIKE '%@demo.edu' AND school_id IN (SELECT id FROM schools WHERE code = $1)`,
        [DEMO_CODE]
      );
      // Courses keep their teachers from being deleted, so remove the school's classes (and their courses) first
      await client.query('DELETE FROM classes WHERE school_id IN (SELECT id FROM schools WHERE code = $1)', [DEMO_CODE]);
      await client.query('DELETE FROM schools WHERE code = $1', [DEMO_CODE]);
    } else if ((await client.query('SELECT 1 FROM schools WHERE code = $1', [DEMO_CODE])).rowCount) {
      console.log('The demo school already exists. Run `npm run seed -- --reset` to recreate it.');
      return;
    }

    const school = await client.query<{ id: string }>(
      'INSERT INTO schools (name, code) VALUES ($1, $2) RETURNING id',
      ['Colegiul Național Demo', DEMO_CODE]
    );
    const schoolId = school.rows[0]!.id;
    await insertUser(client, schoolId, await hashPassword('password123'), {
      firstName: 'Admin',
      lastName: 'Demo',
      email: 'admin@demo.edu',
      role: 'school_admin',
    });
    const { classNames } = await fillSchool(client, schoolId, 'demo.edu');
    console.log(`Demo school created with classes ${classNames.join(', ')}. Sign in as admin@demo.edu / password123`);
  });
}

async function seedExistingSchool(code: string) {
  await withTransaction(async (client) => {
    const school = (
      await client.query<{ id: string; name: string }>('SELECT id, name FROM schools WHERE upper(code) = upper($1)', [code])
    ).rows[0];
    if (!school) throw new Error(`No school has the code ${code}`);

    // The school's own domain keeps these accounts apart from the demo school's
    const emailDomain = `${emailName(code)}.edudesk.test`;
    if ((await client.query('SELECT 1 FROM users WHERE email LIKE $1', [`%@${emailDomain}`])).rowCount) {
      console.log(`${school.name} already has sample data (accounts ending in @${emailDomain}).`);
      return;
    }

    const { classNames } = await fillSchool(client, school.id, emailDomain);
    console.log(
      `Added classes ${classNames.join(', ')} to ${school.name}. Sample accounts end in @${emailDomain} (password123), ` +
        `e.g. elena.popescu@${emailDomain}`
    );
  });
}

// Students for a teacher's empty classes, one list per class; the first in each also gets a parent
const TEACHER_CLASS_STUDENTS = [
  ['Mara Ilie', 'Rareș Cojocaru', 'Ilinca Dobre', 'Sebastian Mitroi', 'Sofia Pârvu', 'Darius Enache', 'Patricia Lupu'],
  ['Bogdan Tănase', 'Clara Vlad', 'Horia Neacșu', 'Diana Costache', 'Nicolas Avram', 'Ruxandra Iancu', 'Tiberiu Manole'],
];
const TEACHER_CLASS_PARENTS = ['Gabriela', 'Sorin'];
// Courses a teacher takes on in classes they don't teach yet
const EXTRA_COURSES = [
  { name: 'Biologie', hoursPerWeek: 2 },
  { name: 'Geografie', hoursPerWeek: 1 },
];

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// The periods (as indexes into PERIODS) on a weekday that don't overlap any of the given lessons
function freePeriods(busy: { weekday: number; start_time: string; end_time: string }[], weekday: number) {
  return PERIODS.flatMap(([start, end], period) =>
    busy.some(
      (lesson) =>
        lesson.weekday === weekday && toMinutes(lesson.start_time) < toMinutes(end) && toMinutes(start) < toMinutes(lesson.end_time)
    )
      ? []
      : [period]
  );
}

async function seedTeacher(email: string) {
  await withTransaction(async (client) => {
    const teacher = (
      await client.query<{ id: string; school_id: string | null; code: string }>(
        `SELECT u.id, u.school_id, s.code FROM users u LEFT JOIN schools s ON s.id = u.school_id
         WHERE lower(u.email) = lower($1) AND u.role = 'teacher'`,
        [email]
      )
    ).rows[0];
    if (!teacher) throw new Error(`No teacher has the email ${email}`);
    if (!teacher.school_id) throw new Error(`${email} isn't in a school yet`);

    const emailDomain = `${emailName(teacher.code)}.edudesk.test`;
    const passwordHash = await hashPassword('password123');
    const added: string[] = [];

    // 1. Students for the teacher's classes that have none
    const emptyClasses = (
      await client.query<{ id: string; name: string }>(
        `SELECT c.id, c.name FROM classes c
         WHERE EXISTS (SELECT 1 FROM courses co WHERE co.class_id = c.id AND co.teacher_id = $1)
           AND NOT EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = c.id)
         ORDER BY length(c.name), c.name`,
        [teacher.id]
      )
    ).rows;
    for (const [classIndex, schoolClass] of emptyClasses.entries()) {
      const names = TEACHER_CLASS_STUDENTS[classIndex % TEACHER_CLASS_STUDENTS.length]!;
      for (const [studentIndex, fullName] of names.entries()) {
        const [firstName, lastName] = fullName.split(' ') as [string, string];
        const studentId = await insertUser(client, teacher.school_id, passwordHash, {
          firstName,
          lastName,
          email: `${emailName(firstName, lastName, schoolClass.name)}@${emailDomain}`,
          role: 'student',
        });
        await client.query('INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)', [schoolClass.id, studentId]);

        // Parent emails have no class in them, so only the first lists get parents
        const parentFirstName = TEACHER_CLASS_PARENTS[classIndex];
        if (studentIndex === 0 && parentFirstName) {
          const parentId = await insertUser(client, teacher.school_id, passwordHash, {
            firstName: parentFirstName,
            lastName,
            email: `${emailName(parentFirstName, lastName)}@${emailDomain}`,
            role: 'parent',
          });
          await client.query('INSERT INTO parent_student (parent_id, student_id) VALUES ($1, $2)', [parentId, studentId]);
        }
      }
      added.push(`7 students in ${schoolClass.name}`);
    }

    // 2. More courses, in classes with students that the teacher doesn't teach yet, in slots free for both.
    //    Skipped once the teacher has any of them, so a second run doesn't pick yet more classes.
    const extraCourseNames = EXTRA_COURSES.map(({ name }) => name);
    const hasExtraCourses = Boolean(
      (await client.query('SELECT 1 FROM courses WHERE teacher_id = $1 AND name = ANY($2::text[])', [teacher.id, extraCourseNames]))
        .rowCount
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
            [teacher.school_id, teacher.id, EXTRA_COURSES.length]
          )
        ).rows;
    const busyOf = async (column: 'teacher_id' | 'class_id', id: string) =>
      (
        await client.query<{ weekday: number; start_time: string; end_time: string }>(
          `SELECT weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
           FROM lessons WHERE ${column} = $1`,
          [id]
        )
      ).rows;

    for (const [index, schoolClass] of otherClasses.entries()) {
      const { name, hoursPerWeek } = EXTRA_COURSES[index]!;
      const course = await client.query<{ id: string }>(
        `INSERT INTO courses (class_id, teacher_id, name, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (class_id, name) DO NOTHING
         RETURNING id`,
        [schoolClass.id, teacher.id, name, YEAR.start, YEAR.end]
      );
      const courseId = course.rows[0]?.id;
      if (!courseId) continue;

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
          [courseId, weekday, startTime, endTime, 'Sala 201']
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
      [teacher.id]
    );
    if (meetings.rowCount) added.push(`${meetings.rowCount} parents' meetings on 13 Oct`);

    console.log(added.length ? `Added for ${email}: ${added.join('; ')}.` : `${email} already has sample data.`);
  });
}

const args = process.argv.slice(2);
const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const schoolCode = valueOf('--school');
const teacherEmail = valueOf('--teacher');

try {
  if (args.includes('--school') && !schoolCode) throw new Error('Usage: npm run seed -- --school <CODE>');
  if (args.includes('--teacher') && !teacherEmail) throw new Error('Usage: npm run seed -- --teacher <EMAIL>');
  if (teacherEmail) await seedTeacher(teacherEmail);
  else if (schoolCode) await seedExistingSchool(schoolCode);
  else await seedDemoSchool(args.includes('--reset'));
} finally {
  await pool.end();
}
