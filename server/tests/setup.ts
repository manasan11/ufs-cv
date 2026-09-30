import { afterAll, beforeEach } from 'vitest';
import { closePool, execute } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { config } from '../src/config/env.js';

const GUARD = 'cv_generator_test';

if (!config.db.database.endsWith(GUARD)) {
  throw new Error(
    `Refusing to run tests against database "${config.db.database}". ` +
      `Set DB_TEST_NAME to a database whose name ends with "${GUARD}".`,
  );
}

await migrate();

beforeEach(async () => {
  await execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['cv_skills', 'cv_education', 'cv_experiences', 'cvs', 'users']) {
    await execute(`TRUNCATE TABLE ${table}`);
  }
  await execute('SET FOREIGN_KEY_CHECKS = 1');
});

afterAll(async () => {
  await closePool();
});
