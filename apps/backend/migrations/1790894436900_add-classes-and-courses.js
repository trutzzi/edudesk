/* eslint-disable camelcase */

export const up = (pgm) => {
  const id = { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') };
  const createdAt = { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') };

  // A group of students for one school year, e.g. "9A" in "2026-2027"
  pgm.createTable('classes', {
    id,
    school_id: { type: 'uuid', notNull: true, references: 'schools', onDelete: 'CASCADE' },
    name: { type: 'varchar(50)', notNull: true },
    school_year: {
      type: 'varchar(9)',
      notNull: true,
      check: "school_year ~ '^[0-9]{4}-[0-9]{4}$'",
    },
    created_at: createdAt,
  });
  // The same school can't have two "9A" classes in the same year
  pgm.addConstraint('classes', 'classes_school_name_year_key', {
    unique: ['school_id', 'name', 'school_year'],
  });

  // Many-to-many: a class has many students, and a student can be in classes across years
  pgm.createTable('class_students', {
    class_id: { type: 'uuid', notNull: true, references: 'classes', onDelete: 'CASCADE' },
    student_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    joined_at: createdAt,
  });
  pgm.addConstraint('class_students', 'class_students_pkey', { primaryKey: ['class_id', 'student_id'] });
  // The primary key index starts with class_id, so lookups by student need their own index
  pgm.createIndex('class_students', 'student_id');

  // A subject taught by one teacher to one class, e.g. "Mathematics" for 9A
  pgm.createTable('courses', {
    id,
    class_id: { type: 'uuid', notNull: true, references: 'classes', onDelete: 'CASCADE' },
    // Nullable so the course survives if its teacher's account is deleted
    teacher_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    name: { type: 'varchar(100)', notNull: true },
    description: { type: 'text' },
    created_at: createdAt,
  });
  pgm.addConstraint('courses', 'courses_class_name_key', { unique: ['class_id', 'name'] });
  pgm.createIndex('courses', 'teacher_id');
};

export const down = (pgm) => {
  pgm.dropTable('courses');
  pgm.dropTable('class_students');
  pgm.dropTable('classes');
};
