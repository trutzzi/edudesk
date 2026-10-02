/* eslint-disable camelcase */

export const up = (pgm) => {
  // An admin's invitation for someone to join their school with a given role
  pgm.createTable('invitations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    school_id: { type: 'uuid', notNull: true, references: 'schools', onDelete: 'CASCADE' },
    // Stored lowercased, like users.email
    email: { type: 'varchar(255)', notNull: true },
    role: { type: 'user_role', notNull: true, check: "role <> 'super_admin'" },
    // Students can be placed straight into a class, parents linked straight to their child
    class_id: { type: 'uuid', references: 'classes', onDelete: 'SET NULL' },
    student_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    // SHA-256 of the token in the emailed link; the token itself is never stored
    token_hash: { type: 'varchar(64)', notNull: true, unique: true },
    invited_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    accepted_at: { type: 'timestamp with time zone' },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint('invitations', 'invitations_class_only_for_students', {
    check: "class_id IS NULL OR role = 'student'",
  });
  pgm.addConstraint('invitations', 'invitations_child_only_for_parents', {
    check: "student_id IS NULL OR role = 'parent'",
  });

  // A partial unique index: one open invitation per person per school, while accepted ones stay as history
  pgm.createIndex('invitations', ['school_id', 'email'], {
    name: 'invitations_one_pending_per_email',
    unique: true,
    where: 'accepted_at IS NULL',
  });
};

export const down = (pgm) => {
  pgm.dropTable('invitations');
};
