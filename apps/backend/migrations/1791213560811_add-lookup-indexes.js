// Indexes for lookups the app makes on every sign-in and page load, which so far scanned whole tables.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  // Sign-in, sign-up and invitations match emails case-insensitively with lower(email); the existing
  // unique index on email can't serve that. Unique, so two accounts can't differ only by case.
  pgm.createIndex('users', 'lower(email)', { name: 'users_lower_email_key', unique: true });
  // People lists and the dashboard's counts: users of one school, by role
  pgm.createIndex('users', ['school_id', 'role']);
  // A class's courses count their lessons, and deleting a course deletes its lessons
  pgm.createIndex('lessons', 'course_id');
  // A parent's timetable goes from their children to classes; the primary key starts with parent_id
  pgm.createIndex('parent_student', 'student_id');
  // "Invitations for me" matches on the invited email across schools
  pgm.createIndex('invitations', 'email');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropIndex('invitations', 'email');
  pgm.dropIndex('parent_student', 'student_id');
  pgm.dropIndex('lessons', 'course_id');
  pgm.dropIndex('users', ['school_id', 'role']);
  pgm.dropIndex('users', 'lower(email)', { name: 'users_lower_email_key' });
};
