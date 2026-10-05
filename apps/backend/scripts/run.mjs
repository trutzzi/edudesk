// Runs one of src/scripts the same way everywhere: `npm run seed`, `npm run holidays`.
// In a checkout it runs the TypeScript source through tsx; in the Docker image, which only has the
// compiled code, it runs the copy in dist. Arguments after the name are passed on.
//
//   node scripts/run.mjs <name> [args…]      e.g. node scripts/run.mjs seed --reset
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCRIPTS = new Map([
  ['seed', 'seed/index'],
  ['holidays', 'holidays'],
]);

const [name, ...args] = process.argv.slice(2);
const script = SCRIPTS.get(name ?? '');
if (!script) {
  console.error(`Unknown script "${name}". Available: ${[...SCRIPTS.keys()].join(', ')}`);
  process.exit(1);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const source = `${root}src/scripts/${script}.ts`;
const compiled = `${root}dist/scripts/${script}.js`;

const command = existsSync(source) ? ['--import', 'tsx', source] : existsSync(compiled) ? [compiled] : null;
if (!command) {
  console.error(`Neither ${source} nor ${compiled} exists; run npm run build first.`);
  process.exit(1);
}

const { status } = spawnSync(process.execPath, [...command, ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
