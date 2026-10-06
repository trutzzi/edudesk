/* eslint-disable camelcase */

// The list every institution starts with; admins add, rename and remove from it
const DEFAULT_THERAPIES = [
  'Kineto',
  'Logopedie',
  'ABA',
  'Terapie Ocupațională',
  'Nirvana',
  'Consiliere Psihologică',
  'Psihoterapie',
  'Coordonare',
  'Grup de dezvoltare',
  'Comunitate',
  'Shadow',
];

export const up = (pgm) => {
  // The therapies (specializations) an institution offers. Courses keep the therapy's name, so renaming one
  // here renames the institution's courses too (the API does both in one transaction).
  pgm.createTable('therapies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    school_id: { type: 'uuid', notNull: true, references: 'schools', onDelete: 'CASCADE' },
    name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('therapies', 'therapies_school_name_key', { unique: ['school_id', 'name'] });

  // Every institution gets the default list, plus the names its courses already use, so nothing existing breaks
  pgm.sql(`
    INSERT INTO therapies (school_id, name)
    SELECT s.id, t.name FROM schools s CROSS JOIN unnest(ARRAY[${DEFAULT_THERAPIES.map((name) => `'${name}'`).join(', ')}]) AS t(name)
    UNION
    SELECT cl.school_id, co.name FROM courses co JOIN classes cl ON cl.id = co.class_id
  `);

  // Specializations point at a therapy instead of repeating its name; deleting a therapy removes them
  pgm.addColumn('therapist_specializations', {
    therapy_id: { type: 'uuid', references: 'therapies', onDelete: 'CASCADE' },
  });
  pgm.sql(`
    UPDATE therapist_specializations ts SET therapy_id = th.id
    FROM users u, therapies th
    WHERE u.id = ts.teacher_id AND th.school_id = u.school_id AND th.name = ts.therapy
  `);
  pgm.sql('DELETE FROM therapist_specializations WHERE therapy_id IS NULL');
  pgm.dropConstraint('therapist_specializations', 'therapist_specializations_pkey');
  pgm.dropColumn('therapist_specializations', 'therapy');
  pgm.alterColumn('therapist_specializations', 'therapy_id', { notNull: true });
  pgm.addConstraint('therapist_specializations', 'therapist_specializations_pkey', { primaryKey: ['teacher_id', 'therapy_id'] });
};

export const down = (pgm) => {
  pgm.addColumn('therapist_specializations', { therapy: { type: 'varchar(100)' } });
  pgm.sql('UPDATE therapist_specializations ts SET therapy = th.name FROM therapies th WHERE th.id = ts.therapy_id');
  pgm.dropConstraint('therapist_specializations', 'therapist_specializations_pkey');
  pgm.dropColumn('therapist_specializations', 'therapy_id');
  pgm.alterColumn('therapist_specializations', 'therapy', { notNull: true });
  pgm.addConstraint('therapist_specializations', 'therapist_specializations_pkey', { primaryKey: ['teacher_id', 'therapy'] });
  pgm.dropTable('therapies');
};
