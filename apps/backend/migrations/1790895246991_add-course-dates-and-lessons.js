/* eslint-disable camelcase */

export const up = (pgm) => {
  // Lets GiST indexes compare plain values (uuid, smallint) with `=`, needed by the exclusion constraints below
  pgm.createExtension('btree_gist', { ifNotExists: true });

  // Postgres has date and timestamp ranges but no range of times of day, so define one
  pgm.sql('CREATE TYPE timerange AS RANGE (subtype = time)');

  // Lesson times are wall-clock times at the school; this says which clock
  pgm.addColumn('schools', {
    timezone: { type: 'varchar(64)', notNull: true, default: 'Europe/Bucharest' },
  });

  // When each course runs. Existing courses get their class's school year: 1 Sep → 30 Jun.
  pgm.addColumns('courses', { start_date: { type: 'date' }, end_date: { type: 'date' } });
  pgm.sql(`
    UPDATE courses co
    SET start_date = make_date(split_part(cl.school_year, '-', 1)::int, 9, 1),
        end_date   = make_date(split_part(cl.school_year, '-', 2)::int, 6, 30)
    FROM classes cl
    WHERE cl.id = co.class_id
  `);
  pgm.alterColumn('courses', 'start_date', { notNull: true });
  pgm.alterColumn('courses', 'end_date', { notNull: true });
  pgm.addConstraint('courses', 'courses_dates_check', { check: 'end_date >= start_date' });

  // Every course needs a teacher now, so lessons can be checked for teacher clashes.
  // NO ACTION (the default) refuses to delete a teacher who still has courses.
  pgm.dropConstraint('courses', 'courses_teacher_id_fkey');
  pgm.alterColumn('courses', 'teacher_id', { notNull: true });
  pgm.addConstraint('courses', 'courses_teacher_id_fkey', { foreignKeys: { columns: 'teacher_id', references: 'users' } });

  // Target for the composite foreign key below; id alone is already unique, so this costs nothing logically
  pgm.addConstraint('courses', 'courses_schedule_key', {
    unique: ['id', 'class_id', 'teacher_id', 'start_date', 'end_date'],
  });

  // One weekly slot of a course: "Matematică, Monday 08:00–08:50, Sala 101"
  pgm.createTable('lessons', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    course_id: { type: 'uuid', notNull: true },
    // Copies of the course's columns, kept in sync by the foreign key below.
    // The exclusion constraints can only look at columns of this table.
    class_id: { type: 'uuid', notNull: true },
    teacher_id: { type: 'uuid', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    // ISO weekday: 1 = Monday … 7 = Sunday
    weekday: { type: 'smallint', notNull: true, check: 'weekday BETWEEN 1 AND 7' },
    start_time: { type: 'time', notNull: true },
    end_time: { type: 'time', notNull: true },
    room: { type: 'varchar(50)' },
  });
  pgm.addConstraint('lessons', 'lessons_times_check', { check: 'end_time > start_time' });

  // ON UPDATE CASCADE: changing a course's teacher or dates rewrites the copies in its lessons
  pgm.addConstraint(
    'lessons',
    'lessons_course_fkey',
    `FOREIGN KEY (course_id, class_id, teacher_id, start_date, end_date)
     REFERENCES courses (id, class_id, teacher_id, start_date, end_date)
     ON UPDATE CASCADE ON DELETE CASCADE`,
  );

  // Two lessons clash when they're on the same weekday, their times overlap and their courses' dates overlap.
  // `&&` means "overlaps"; timerange defaults to [start, end), so 08:00–08:50 and 08:50–09:40 don't clash.
  const clash = `weekday WITH =,
    timerange(start_time, end_time) WITH &&,
    daterange(start_date, end_date, '[]') WITH &&`;
  pgm.addConstraint('lessons', 'lessons_no_teacher_clash', `EXCLUDE USING gist (teacher_id WITH =, ${clash})`);
  pgm.addConstraint('lessons', 'lessons_no_class_clash', `EXCLUDE USING gist (class_id WITH =, ${clash})`);
};

export const down = (pgm) => {
  pgm.dropTable('lessons');
  pgm.dropConstraint('courses', 'courses_schedule_key');
  pgm.dropConstraint('courses', 'courses_teacher_id_fkey');
  pgm.alterColumn('courses', 'teacher_id', { notNull: false });
  pgm.addConstraint('courses', 'courses_teacher_id_fkey', {
    foreignKeys: { columns: 'teacher_id', references: 'users', onDelete: 'SET NULL' },
  });
  pgm.dropConstraint('courses', 'courses_dates_check');
  pgm.dropColumns('courses', ['start_date', 'end_date']);
  pgm.dropColumn('schools', 'timezone');
  pgm.dropType('timerange');
  pgm.dropExtension('btree_gist');
};
