/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumns('users', {
    // NULL until the user clicks the link in their verification email
    email_verified_at: { type: 'timestamp with time zone' },
    // HMAC of the IP the account was created from: enough to count sign-ups per IP, without storing the IP
    registration_ip_hash: { type: 'varchar(64)' },
  });
  // Accounts that existed before verification was introduced keep working
  pgm.sql('UPDATE users SET email_verified_at = created_at');
  pgm.createIndex('users', ['registration_ip_hash', 'created_at']);

  pgm.createTable('email_verification_tokens', {
    // SHA-256 of the token in the email link. A leaked database can't be used to verify accounts.
    token_hash: { type: 'varchar(64)', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    expires_at: { type: 'timestamp with time zone', notNull: true },
    created_at: { type: 'timestamp with time zone', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('email_verification_tokens', 'user_id');
};

export const down = (pgm) => {
  pgm.dropTable('email_verification_tokens');
  pgm.dropColumns('users', ['email_verified_at', 'registration_ip_hash']);
};
