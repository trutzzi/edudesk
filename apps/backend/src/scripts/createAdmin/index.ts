// Creates an institution's first administrator. There is no public sign-up: after this, the admin adds
// therapists and clients from the dashboard.
//
//   npm run create-admin -- --code BLUE --institution "Centrul Blue" --first Ana --last Pop --email ana@blue.ro
//
// On the server, from the deploy folder:
//   docker compose run --rm edudesk-api node dist/scripts/createAdmin/index.js --code BLUE …
import 'dotenv/config';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { generatePassword } from '../../lib/generatePassword.js';
import { hashPassword } from '../../lib/password.js';
import { isPgError, PG_ERRORS } from '../../lib/validation.js';
import { createSchool } from '../../modules/schools/schools.repository.js';
import { MIN_ADMIN_PASSWORD_LENGTH, parseAdminArgs, USAGE } from './args.js';

const ADMIN_PASSWORD_LENGTH = 12;
const DEFAULT_TIMEZONE = 'Europe/Bucharest';

async function main() {
  const args = parseAdminArgs(process.argv.slice(2));
  const chosen = process.env.ADMIN_PASSWORD;
  if (chosen !== undefined && chosen.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD needs at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }
  const password = chosen ?? generatePassword(ADMIN_PASSWORD_LENGTH);

  const institution = await withTransaction(async (client) => {
    let school = (await client.query<{ id: string; name: string }>('SELECT id, name FROM schools WHERE code = $1', [args.code])).rows[0];
    if (!school) {
      if (!args.institution) throw new Error(`No institution has the code ${args.code}. Add --institution "<name>" to create it.`);
      school = { id: await createSchool(client, args.institution, args.code, DEFAULT_TIMEZONE), name: args.institution };
    }
    if (args.appName || args.color) {
      await client.query('UPDATE schools SET app_name = COALESCE($2, app_name), brand_color = COALESCE($3, brand_color) WHERE id = $1', [
        school.id,
        args.appName,
        args.color,
      ]);
    }

    await client.query(
      `INSERT INTO users (school_id, role, first_name, last_name, email, phone, password_hash, email_verified_at)
       VALUES ($1, 'school_admin', $2, $3, $4, $5, $6, now())`,
      [school.id, args.firstName, args.lastName, args.email, args.phone, await hashPassword(password)],
    );
    return school.name;
  });

  const login = args.email ?? args.phone;
  console.log(`${args.firstName} ${args.lastName} is now an administrator of ${institution}.`);
  console.log(chosen ? `Sign in as ${login} with ADMIN_PASSWORD.` : `Sign in as ${login} with this password, shown only now: ${password}`);
}

try {
  await main();
} catch (err) {
  if (isPgError(err, PG_ERRORS.uniqueViolation)) console.error('Someone already has this email or phone number.');
  else console.error(err instanceof Error ? err.message : err);
  console.error(`\n${USAGE}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
