// Sample data for trying the app. Every account it creates has the password "password123", or
// SEED_PASSWORD when set; production requires one (see the guard below).
//
//   npm run seed                       creates the demo school (code DEMO) with its admin, admin@demo.edu
//   npm run seed -- --reset            deletes the demo school and creates it again
//   npm run seed -- --school <CODE>    adds the same kind of data to an existing school, e.g. your own.
//                                      It only adds: new classes get names the school doesn't use yet.
//   npm run seed -- --teacher <EMAIL>  fills in around an existing teacher: students for their empty
//                                      classes, two more courses in free slots, and parents' meetings.
import 'dotenv/config';
import { pool } from '../../db/pool.js';
import { DEV_PASSWORD } from './data.js';
import { seedDemoSchool, seedExistingSchool } from './schools.js';
import { seedTeacher } from './teacher.js';

const args = process.argv.slice(2);
const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const schoolCode = valueOf('--school');
const teacherEmail = valueOf('--teacher');

// Sample accounts all share one password, so on a live database it must be one only you know
const MIN_PRODUCTION_PASSWORD = 12;
const seedPassword = process.env.SEED_PASSWORD ?? '';
if (process.env.NODE_ENV === 'production' && (seedPassword.length < MIN_PRODUCTION_PASSWORD || seedPassword === DEV_PASSWORD)) {
  console.error(`In production, set SEED_PASSWORD to a password of at least ${MIN_PRODUCTION_PASSWORD} characters.`);
  process.exit(1);
}

try {
  if (args.includes('--school') && !schoolCode) throw new Error('Usage: npm run seed -- --school <CODE>');
  if (args.includes('--teacher') && !teacherEmail) throw new Error('Usage: npm run seed -- --teacher <EMAIL>');
  if (teacherEmail) await seedTeacher(teacherEmail);
  else if (schoolCode) await seedExistingSchool(schoolCode);
  else await seedDemoSchool(args.includes('--reset'));
} catch (err) {
  // A wrong code or email is a usage mistake: say what's wrong, without a stack trace
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
