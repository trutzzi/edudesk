/* eslint-disable camelcase */

export const up = (pgm) => {
  // Admins create clients and therapists themselves, with a phone and no email needed.
  // Phones are stored normalized ("+40722123456"), so one person's number can't be saved twice in two spellings.
  pgm.alterColumn('users', 'email', { notNull: false });
  pgm.addColumn('users', { phone: { type: 'varchar(20)' } });
  pgm.createIndex('users', 'phone', { name: 'users_phone_key', unique: true, where: 'phone IS NOT NULL' });
  pgm.addConstraint('users', 'users_email_or_phone', { check: 'email IS NOT NULL OR phone IS NOT NULL' });

  // How a client's therapy is paid for; only clients (role student) have one
  pgm.createType('payment_type', ['cas', 'sponsored']);
  pgm.addColumn('users', { payment_type: { type: 'payment_type' } });
  pgm.addConstraint('users', 'users_payment_only_for_clients', { check: "payment_type IS NULL OR role = 'student'" });

  // The therapies a therapist may run; a course's therapist must have its therapy
  pgm.createTable('therapist_specializations', {
    teacher_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    therapy: { type: 'varchar(100)', notNull: true },
  });
  pgm.addConstraint('therapist_specializations', 'therapist_specializations_pkey', { primaryKey: ['teacher_id', 'therapy'] });

  // Whether a client came to one session. A session is a course on a date at a start time: lessons are
  // deleted and recreated whenever a schedule is saved, so their ids can't anchor history.
  // Every change is a new row, so nothing is lost; the latest row per session and client is the status.
  // A session with no row counts as present.
  pgm.createType('attendance_status', ['present', 'absent_notice', 'absent_late', 'cancelled']);
  pgm.createTable('attendance_marks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    course_id: { type: 'uuid', notNull: true, references: 'courses', onDelete: 'CASCADE' },
    student_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    date: { type: 'date', notNull: true },
    start_time: { type: 'time', notNull: true },
    status: { type: 'attendance_status', notNull: true },
    marked_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    marked_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('clock_timestamp()') },
  });
  // Finding the latest mark of a session, and a client's marks over a month
  pgm.createIndex('attendance_marks', ['course_id', 'date', 'start_time', 'student_id', { name: 'marked_at', sort: 'DESC' }], {
    name: 'attendance_marks_latest',
  });
  pgm.createIndex('attendance_marks', ['student_id', 'date']);
};

export const down = (pgm) => {
  pgm.dropTable('attendance_marks');
  pgm.dropType('attendance_status');
  pgm.dropTable('therapist_specializations');
  pgm.dropConstraint('users', 'users_payment_only_for_clients');
  pgm.dropColumn('users', 'payment_type');
  pgm.dropType('payment_type');
  pgm.dropConstraint('users', 'users_email_or_phone');
  pgm.dropIndex('users', 'phone', { name: 'users_phone_key' });
  pgm.dropColumn('users', 'phone');
  pgm.alterColumn('users', 'email', { notNull: true });
};
