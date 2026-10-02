/* eslint-disable camelcase */

export const up = (pgm) => {
  // Which country's public holidays apply to a school (ISO 3166 code)
  pgm.addColumn('schools', {
    country: { type: 'char(2)', notNull: true, default: 'RO' },
  });

  // National public holidays, loaded from data/holidays/<COUNTRY>.json by `npm run holidays`.
  // The JSON file is the source of truth; this table is a copy the queries can join.
  pgm.createTable('public_holidays', {
    country: { type: 'char(2)', notNull: true },
    date: { type: 'date', notNull: true },
    // In the country's language, e.g. "Ziua Națională"
    local_name: { type: 'varchar(150)', notNull: true },
    // In English, e.g. "National Day"
    name: { type: 'varchar(150)', notNull: true },
  });
  pgm.addConstraint('public_holidays', 'public_holidays_pkey', { primaryKey: ['country', 'date'] });
};

export const down = (pgm) => {
  pgm.dropTable('public_holidays');
  pgm.dropColumn('schools', 'country');
};
