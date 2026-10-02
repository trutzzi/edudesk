/* eslint-disable camelcase */

export const up = (pgm) => {
  // Things on the school calendar that span one or more days
  pgm.createType('event_kind', ['holiday', 'exam', 'trip', 'meeting', 'other']);

  pgm.createTable('school_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    school_id: { type: 'uuid', notNull: true, references: 'schools', onDelete: 'CASCADE' },
    // NULL means the whole school; otherwise only this class
    class_id: { type: 'uuid', references: 'classes', onDelete: 'CASCADE' },
    title: { type: 'varchar(150)', notNull: true },
    kind: { type: 'event_kind', notNull: true, default: 'other' },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    created_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint('school_events', 'school_events_dates_check', { check: 'end_date >= start_date' });
  // The calendar always asks "this school's events around these dates"
  pgm.createIndex('school_events', ['school_id', 'start_date']);
};

export const down = (pgm) => {
  pgm.dropTable('school_events');
  pgm.dropType('event_kind');
};
