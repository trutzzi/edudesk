// National public holidays: the JSON files in data/holidays are the source of truth, and this
// keeps the public_holidays table in step with them.
//
//   npm run holidays                                 copies every data/holidays/<COUNTRY>.json into the database:
//                                                    adds new dates, updates names, removes deleted dates
//   npm run holidays -- --fetch 2026 2027            first refreshes those years of RO.json from the
//   npm run holidays -- --fetch 2027 --country MD    free Nager.Date API (https://date.nager.at), then syncs
//
// To change a holiday, edit the JSON and run `npm run holidays` again.
import 'dotenv/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { isDateString } from '../lib/validation.js';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/holidays');
const API_URL = 'https://date.nager.at/api/v3/PublicHolidays';

interface Holiday {
  date: string;
  localName: string;
  name: string;
}

interface HolidayFile {
  country: string;
  source: string;
  holidays: Holiday[];
}

const fileFor = (country: string) => path.join(DATA_DIR, `${country}.json`);

async function readFileFor(country: string): Promise<HolidayFile> {
  try {
    return JSON.parse(await readFile(fileFor(country), 'utf8')) as HolidayFile;
  } catch {
    return { country, source: API_URL, holidays: [] };
  }
}

// Fails on anything a person editing the file could get wrong, naming the entry
function validate(file: HolidayFile, fileName: string) {
  if (!/^[A-Z]{2}$/.test(file.country)) throw new Error(`${fileName}: "country" must be a two-letter code like "RO"`);
  const seen = new Set<string>();
  for (const holiday of file.holidays) {
    const where = `${fileName}: ${JSON.stringify(holiday)}`;
    if (!isDateString(holiday.date)) throw new Error(`${where} has an invalid date (use YYYY-MM-DD)`);
    if (!holiday.localName?.trim() || !holiday.name?.trim()) throw new Error(`${where} needs a "localName" and a "name"`);
    if (seen.has(holiday.date)) throw new Error(`${where}: the date appears twice; join the names instead`);
    seen.add(holiday.date);
  }
}

// Downloads the given years and replaces them in the country's JSON file, keeping every other year as it is
async function fetchYears(country: string, years: string[]) {
  const file = await readFileFor(country);

  for (const year of years) {
    const response = await fetch(`${API_URL}/${year}/${country}`);
    if (!response.ok) throw new Error(`${API_URL}/${year}/${country} answered ${response.status}`);
    const fetched = (await response.json()) as Holiday[];

    // Two holidays can fall on one date (e.g. Children's Day and Whit Monday); the table keeps one row per date
    const byDate = new Map<string, Holiday>();
    for (const { date, localName, name } of fetched) {
      const existing = byDate.get(date);
      byDate.set(
        date,
        existing && existing.localName !== localName
          ? { date, localName: `${existing.localName} / ${localName}`, name: `${existing.name} / ${name}` }
          : (existing ?? { date, localName, name }),
      );
    }

    file.holidays = [...file.holidays.filter(({ date }) => !date.startsWith(`${year}-`)), ...byDate.values()];
    console.log(`Fetched ${byDate.size} holidays for ${country} ${year}`);
  }

  file.holidays.sort((a, b) => a.date.localeCompare(b.date));
  await writeFile(fileFor(country), `${JSON.stringify(file, null, 2)}\n`);
}

// Makes the table match the JSON files exactly
async function sync() {
  const fileNames = (await readdir(DATA_DIR)).filter((name) => name.endsWith('.json'));

  for (const fileName of fileNames) {
    const file = JSON.parse(await readFile(path.join(DATA_DIR, fileName), 'utf8')) as HolidayFile;
    validate(file, fileName);

    await withTransaction(async (client) => {
      const removed = await client.query('DELETE FROM public_holidays WHERE country = $1 AND NOT (date = ANY($2::date[]))', [
        file.country,
        file.holidays.map(({ date }) => date),
      ]);
      // jsonb_to_recordset turns the whole list into rows for one upsert
      await client.query(
        `INSERT INTO public_holidays (country, date, local_name, name)
         SELECT $1, h.date, h."localName", h.name
         FROM jsonb_to_recordset($2::jsonb) AS h(date date, "localName" text, name text)
         ON CONFLICT (country, date) DO UPDATE SET local_name = EXCLUDED.local_name, name = EXCLUDED.name`,
        [file.country, JSON.stringify(file.holidays)],
      );
      console.log(`${file.country}: ${file.holidays.length} holidays in the database, ${removed.rowCount} removed`);
    });
  }
}

const args = process.argv.slice(2);
const country = (args.includes('--country') ? args[args.indexOf('--country') + 1] : 'RO')!.toUpperCase();
const years = args.includes('--fetch') ? args.slice(args.indexOf('--fetch') + 1).filter((arg) => /^\d{4}$/.test(arg)) : [];

try {
  if (args.includes('--fetch') && years.length === 0) throw new Error('Usage: npm run holidays -- --fetch 2026 2027');
  if (years.length > 0) await fetchYears(country, years);
  await sync();
} finally {
  await pool.end();
}
