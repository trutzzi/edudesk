/* eslint-disable camelcase */

export const up = (pgm) => {
  // Extensie pentru UUID
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // Enum pentru roluri
  pgm.createType('user_role', ['super_admin', 'school_admin', 'teacher', 'student', 'parent']);

  // Tabla: Școli
  pgm.createTable('schools', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'varchar(255)', notNull: true },
    code: { type: 'varchar(50)', notNull: true, unique: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });

  // Tabla: Utilizatori
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    school_id: { type: 'uuid', references: 'schools', onDelete: 'CASCADE' },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    role: { type: 'user_role', notNull: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });

  // Tabla: Relație Părinte - Student
  pgm.createTable('parent_student', {
    parent_id: { type: 'uuid', references: 'users', onDelete: 'CASCADE' },
    student_id: { type: 'uuid', references: 'users', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('parent_student', 'pk_parent_student', {
    primaryKey: ['parent_id', 'student_id'],
  });

  // Tabla: Note / Evaluări
  pgm.createTable('grades', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    student_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    teacher_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    score: { type: 'numeric(5, 2)', notNull: true },
    notes: { type: 'text' },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });
};

export const down = (pgm) => {
  pgm.dropTable('grades');
  pgm.dropTable('parent_student');
  pgm.dropTable('users');
  pgm.dropTable('schools');
  pgm.dropType('user_role');
};