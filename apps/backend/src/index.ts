import 'dotenv/config';
import { createApp } from './app.js';
import { env, productionConfigProblems } from './config/env.js';
import { pruneLogs } from './modules/monitoring/logs.repository.js';

const LOG_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const problems = productionConfigProblems();
if (problems.length > 0) {
  console.error(`Refusing to start in production:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

createApp().listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

// unref() lets the process exit without waiting for the next clean-up
void pruneLogs();
setInterval(() => void pruneLogs(), LOG_CLEANUP_INTERVAL_MS).unref();
