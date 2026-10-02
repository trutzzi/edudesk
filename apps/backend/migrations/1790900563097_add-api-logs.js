/* eslint-disable camelcase */

export const up = (pgm) => {
  // Problems worth an admin's attention: failed or slow API requests, and crashes in the web app.
  // Never holds request bodies, passwords or tokens.
  pgm.createTable('api_logs', {
    id: { type: 'bigserial', primaryKey: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
    level: { type: 'varchar(5)', notNull: true, check: "level IN ('error', 'warn')" },
    // 'api' for requests to this server, 'web' for errors reported by the browser
    source: { type: 'varchar(3)', notNull: true, default: 'api', check: "source IN ('api', 'web')" },
    method: { type: 'varchar(10)' },
    // Route with ids replaced by :id and no query string, e.g. /api/classes/:id; a page path for web errors
    path: { type: 'varchar(500)', notNull: true },
    status: { type: 'smallint' },
    duration_ms: { type: 'integer' },
    // What the user was told, e.g. "Class not found"
    message: { type: 'text' },
    code: { type: 'varchar(50)' },
    // Internal detail such as a stack trace: only shown to super admins
    detail: { type: 'text' },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    school_id: { type: 'uuid', references: 'schools', onDelete: 'CASCADE' },
  });
  // The admin views always ask for "this school's newest entries"
  pgm.createIndex('api_logs', ['school_id', { name: 'created_at', sort: 'DESC' }]);
  // For the retention clean-up and super admins' platform-wide view
  pgm.createIndex('api_logs', 'created_at');
};

export const down = (pgm) => {
  pgm.dropTable('api_logs');
};
