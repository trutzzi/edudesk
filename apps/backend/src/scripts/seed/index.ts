// Sample data for trying the app. Every account it creates has the password "password123".
//
//   npm run seed                       creates the demo school (code DEMO) with its admin, admin@demo.edu
//   npm run seed -- --reset            deletes the demo school and creates it again
//   npm run seed -- --school <CODE>    adds the same kind of data to an existing school, e.g. your own.
//                                      It only adds: new classes get names the school doesn't use yet.
//   npm run seed -- --teacher <EMAIL>  fills in around an existing teacher: students for their empty
//                                      classes, two more courses in free slots, and parents' meetings.
import 'dotenv/config';
import { pool } from '../../db/pool.js';
import { seedDemoSchool, seedExistingSchool } from './schools.js';
import { seedTeacher } from './teacher.js';

const args = process.argv.slice(2);
const valueOf = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const schoolCode = valueOf('--school');
const teacherEmail = valueOf('--teacher');

// Sample accounts all share a known password, so they must never reach a live database
if (process.env.NODE_ENV === 'production') {
  console.error('The seed script does not run with NODE_ENV=production.');
  process.exit(1);
}

try {
  if (args.includes('--school') && !schoolCode) throw new Error('Usage: npm run seed -- --school <CODE>');
  if (args.includes('--teacher') && !teacherEmail) throw new Error('Usage: npm run seed -- --teacher <EMAIL>');
  if (teacherEmail) await seedTeacher(teacherEmail);
  else if (schoolCode) await seedExistingSchool(schoolCode);
  else await seedDemoSchool(args.includes('--reset'));
} finally {
  await pool.end();
}
