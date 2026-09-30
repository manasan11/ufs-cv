import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createServerPool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Splits the schema file into individual statements. */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) =>
      statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

interface ExpectedColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface ExpectedTable {
  name: string;
  columns: ExpectedColumn[];
  statement: string;
}

const CONSTRAINT_KEYWORDS =
  /\b(NOT\s+NULL|NULL|DEFAULT|AUTO_INCREMENT|UNIQUE|PRIMARY|KEY|COMMENT|CHECK|REFERENCES|COLLATE|CHARACTER\s+SET|GENERATED)\b/i;

/** Normalises a column type for comparison (case/whitespace insensitive). */
function normaliseType(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Extracts each table's name and column definitions from the CREATE TABLE
 * statements so schema.sql stays the single source of truth for drift
 * detection.
 */
function parseExpectedTables(statements: string[]): ExpectedTable[] {
  const tables: ExpectedTable[] = [];

  for (const statement of statements) {
    const header = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?(\w+)`?\s*\(/i.exec(statement);
    if (!header) continue;

    const tableName = header[1]!;
    // The body runs from the first "(" to the last ")", because the statement
    // continues with table options such as ENGINE = InnoDB ... after it.
    const bodyStart = statement.indexOf('(', header.index + header[0].length - 1) + 1;
    const bodyEnd = statement.lastIndexOf(')');
    if (bodyStart <= 0 || bodyEnd <= bodyStart) continue;

    const columns: ExpectedColumn[] = [];
    for (const rawLine of statement.slice(bodyStart, bodyEnd).split(/\r?\n/)) {
      const line = rawLine.trim().replace(/,$/, '');
      if (line === '') continue;
      if (/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|CHECK|INDEX)\b/i.test(line)) continue;

      const match = /^`?(\w+)`?\s+([^(]+)/.exec(line);
      if (!match) continue;

      const name = match[1]!;
      const definition = line.slice(match[0].length - match[2]!.length);
      const constraint = CONSTRAINT_KEYWORDS.exec(definition);
      const type = constraint ? definition.slice(0, constraint.index) : definition;
      const nullable = !/\bNOT\s+NULL\b/i.test(definition);

      columns.push({ name, type: normaliseType(type), nullable });
    }

    tables.push({ name: tableName, columns, statement });
  }

  return tables;
}

/** Columns that hold FK references, so a rebuild can drop children first. */
const DEPENDENT_ORDER = ['cv_skills', 'cv_education', 'cv_experiences', 'cvs', 'users'];

interface ActualColumn {
  name: string;
  type: string;
  nullable: boolean;
}

async function tableExists(connection: PoolConnection, table: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT 1 AS present FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [config.db.database, table],
  );
  return rows.length > 0;
}

async function actualColumns(connection: PoolConnection, table: string): Promise<ActualColumn[]> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT column_name AS name, column_type AS type, is_nullable AS nullable
       FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?`,
    [config.db.database, table],
  );

  return rows.map((row) => ({
    name: String(row.name),
    type: normaliseType(String(row.type)),
    nullable: String(row.nullable).toUpperCase() === 'YES',
  }));
}

async function countRows(connection: PoolConnection, table: string): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM \`${table}\``,
  );
  return Number(rows[0]?.total ?? 0);
}

function describeDrift(expected: ExpectedTable, actual: ActualColumn[]): string[] {
  const problems: string[] = [];
  const actualByName = new Map(actual.map((column) => [column.name, column]));

  for (const column of expected.columns) {
    const found = actualByName.get(column.name);
    if (!found) {
      problems.push(`missing column ${column.name}`);
      continue;
    }
    if (found.type !== column.type) {
      problems.push(`${column.name} type is "${found.type}", expected "${column.type}"`);
    }
    if (found.nullable !== column.nullable) {
      problems.push(`${column.name} nullability differs`);
    }
  }

  for (const column of actual) {
    if (!expected.columns.some((candidate) => candidate.name === column.name)) {
      problems.push(`unexpected column ${column.name}`);
    }
  }

  return problems;
}

/**
 * Applies schema.sql, rebuilding every table when any of them has drifted.
 *
 * CREATE TABLE IF NOT EXISTS alone silently keeps a stale table, and rebuilding
 * a single child table can fail if a parent column's type changed underneath
 * it. Detecting drift first and then recreating the whole set in one shot keeps
 * the tables mutually consistent.
 */
async function applySchema(
  connection: PoolConnection,
  expected: ExpectedTable[],
  force: boolean,
): Promise<{ created: string[]; rebuilt: string[] }> {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    const drifted: string[] = [];
    const missing: string[] = [];

    for (const table of expected) {
      if (!(await tableExists(connection, table.name))) {
        missing.push(table.name);
        continue;
      }
      const problems = describeDrift(table, await actualColumns(connection, table.name));
      if (problems.length > 0) {
        drifted.push(`${table.name}: ${problems.join('; ')}`);
      }
    }

    if (drifted.length === 0) {
      for (const table of expected) {
        if (missing.includes(table.name)) await connection.query(table.statement);
      }
      return { created: missing, rebuilt: [] };
    }

    // Recreating a table drops its rows, so never do it to a populated
    // database unless the caller explicitly opts in.
    const populated: string[] = [];
    for (const table of expected) {
      if (missing.includes(table.name)) continue;
      if ((await countRows(connection, table.name)) > 0) populated.push(table.name);
    }

    if (populated.length > 0 && !force) {
      const counts: string[] = [];
      for (const table of populated) {
        counts.push(`${table}=${await countRows(connection, table)}`);
      }
      throw new Error(
        [
          'Schema drift detected, but these tables still hold data:',
          ...drifted.map((entry) => `  - ${entry}`),
          `  row counts: ${counts.join(', ')}`,
          'Refusing to drop the existing tables.',
          'Fix schema.sql, or re-run with --force to recreate the tables and lose that data.',
        ].join('\n'),
      );
    }

    logger.warn('Schema drift detected - recreating every table:');
    for (const entry of drifted) logger.warn(`  - ${entry}`);

    // Reverse dependency order so parents are dropped after their children.
    for (const table of [...expected].reverse()) {
      await connection.query(`DROP TABLE IF EXISTS \`${table.name}\``);
    }
    for (const table of expected) {
      await connection.query(table.statement);
    }

    return { created: [], rebuilt: expected.map((table) => table.name) };
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function withPool<T>(database: string | undefined, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = createServerPool(database);
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function withConnection<T>(
  pool: Pool,
  fn: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    return await fn(connection);
  } finally {
    connection.release();
  }
}

async function ensureDatabase(): Promise<void> {
  await withPool(undefined, async (pool) => {
    await pool.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  });
  logger.info(`Database ready: ${config.db.database}`);
}

export interface MigrateOptions {
  /** Recreate drifted tables even when they still hold data. */
  force?: boolean;
}

export async function migrate(options: MigrateOptions = {}): Promise<void> {
  await ensureDatabase();

  const statements = splitStatements(await readFile(join(here, 'schema.sql'), 'utf8'));
  const expected = parseExpectedTables(statements);

  const { created, rebuilt } = await withPool(config.db.database, (pool) =>
    withConnection(pool, (connection) => applySchema(connection, expected, options.force ?? false)),
  );

  for (const name of created) logger.info(`Created: ${name}`);
  if (rebuilt.length > 0) {
    logger.warn(`Recreated ${rebuilt.length} table(s) to match schema.sql: ${rebuilt.join(', ')}`);
  }

  const existing = await withPool(config.db.database, async (pool) => {
    const [rows] = await pool.query<RowDataPacket[]>('SHOW TABLES');
    return rows.map((row) => String(Object.values(row)[0]));
  });

  logger.info(`Migration complete. Tables: ${existing.sort().join(', ')}`);
}

export { DEPENDENT_ORDER };

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  migrate({ force: process.argv.includes('--force') })
    .then(() => {
      logger.info('Done');
    })
    .catch((error: unknown) => {
      logger.error('Migration failed', error);
      process.exitCode = 1;
    });
}
