/* eslint-disable camelcase */

export const up = (pgm) => {
  // How the app looks to an institution's people once they sign in: its own name in place of "Blue", its logo
  // and its main color. Unset means the default look.
  pgm.addColumns('schools', {
    app_name: { type: 'varchar(60)' },
    brand_color: { type: 'char(7)', check: "brand_color ~ '^#[0-9a-f]{6}$'" },
    // A small image, kept here so backups carry it; served by GET /api/schools/:id/logo
    logo: { type: 'bytea' },
    logo_type: { type: 'varchar(20)' },
    // Changes the logo's URL whenever it changes, so browsers never show a cached old one
    logo_updated_at: { type: 'timestamp with time zone' },
  });
  pgm.addConstraint('schools', 'schools_logo_has_type', { check: '(logo IS NULL) = (logo_type IS NULL)' });
};

export const down = (pgm) => {
  pgm.dropConstraint('schools', 'schools_logo_has_type');
  pgm.dropColumns('schools', ['app_name', 'brand_color', 'logo', 'logo_type', 'logo_updated_at']);
};
