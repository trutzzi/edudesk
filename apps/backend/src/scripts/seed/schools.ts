import { withTransaction } from '../../db/transaction.js';
import { hashPassword } from '../../lib/password.js';
import { DEMO_CODE, emailName, passwordHint, samplePassword } from './data.js';
import { fillSchool } from './fillSchool.js';
import { insertUser } from './users.js';

export async function seedDemoSchool(reset: boolean) {
  await withTransaction(async (client) => {
    if (reset) {
      // Accounts that aren't demo accounts (like your own, linked to the demo school) are kept, just unlinked
      await client.query(
        `UPDATE users SET school_id = NULL
         WHERE email NOT LIKE '%@demo.edu' AND school_id IN (SELECT id FROM schools WHERE code = $1)`,
        [DEMO_CODE],
      );
      // Courses keep their teachers from being deleted, so remove the school's classes (and their courses) first
      await client.query('DELETE FROM classes WHERE school_id IN (SELECT id FROM schools WHERE code = $1)', [DEMO_CODE]);
      await client.query('DELETE FROM schools WHERE code = $1', [DEMO_CODE]);
    } else if ((await client.query('SELECT 1 FROM schools WHERE code = $1', [DEMO_CODE])).rowCount) {
      console.log('The demo school already exists. Run `npm run seed -- --reset` to recreate it.');
      return;
    }

    const school = await client.query<{ id: string }>('INSERT INTO schools (name, code) VALUES ($1, $2) RETURNING id', [
      'Colegiul Național Demo',
      DEMO_CODE,
    ]);
    const schoolId = school.rows[0]!.id;
    await insertUser(client, schoolId, await hashPassword(samplePassword()), {
      firstName: 'Admin',
      lastName: 'Demo',
      email: 'admin@demo.edu',
      role: 'school_admin',
    });
    const { classNames } = await fillSchool(client, schoolId, 'demo.edu');
    console.log(`Demo school created with classes ${classNames.join(', ')}. Sign in as admin@demo.edu with ${passwordHint()}`);
  });
}

export async function seedExistingSchool(code: string) {
  await withTransaction(async (client) => {
    const school = (await client.query<{ id: string; name: string }>('SELECT id, name FROM schools WHERE upper(code) = upper($1)', [code]))
      .rows[0];
    if (!school) throw new Error(`No school has the code ${code}`);

    // The school's own domain keeps these accounts apart from the demo school's
    const emailDomain = `${emailName(code)}.edudesk.test`;
    if ((await client.query('SELECT 1 FROM users WHERE email LIKE $1', [`%@${emailDomain}`])).rowCount) {
      console.log(`${school.name} already has sample data (accounts ending in @${emailDomain}).`);
      return;
    }

    const { classNames } = await fillSchool(client, school.id, emailDomain);
    console.log(
      `Added classes ${classNames.join(', ')} to ${school.name}. Sample accounts end in @${emailDomain} (${passwordHint()}), ` +
        `e.g. elena.popescu@${emailDomain}`,
    );
  });
}
