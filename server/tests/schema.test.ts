import { describe, expect, it } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { config } from '../src/config/env.js';
import { createServerPool, execute } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import {
  createCvSchema,
  registerSchema,
} from '../src/validation/schemas.js';

/**
 * These tests guard two bugs that silently broke the app:
 *  - validation limits that were far smaller than the database columns
 *  - `migrate` dropping every table, and the rows in them, on any drift
 */

async function columnWidth(table: string, column: string): Promise<number> {
  const pool = createServerPool(config.db.database);
  try {
    const [rows] = await pool.query<Array<RowDataPacket & { CHARACTER_MAXIMUM_LENGTH: number | null }>>(
      `SELECT CHARACTER_MAXIMUM_LENGTH
         FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
      [config.db.database, table, column],
    );
    return Number(rows[0]?.CHARACTER_MAXIMUM_LENGTH ?? 0);
  } finally {
    await pool.end();
  }
}

describe('schema columns are wide enough for the validation limits', () => {
  it('stores a full name as long as the API accepts', async () => {
    const limit = 120;
    expect(registerSchema.safeParse({ fullName: 'A'.repeat(limit), email: 'a@b.co', password: 'password1' }).success).toBe(true);

    for (const table of ['users', 'cvs']) {
      expect(await columnWidth(table, 'full_name')).toBeGreaterThanOrEqual(limit);
    }
  });

  it('stores a skill name as long as the API accepts', async () => {
    const limit = 60;
    const payload = {
      personal: { fullName: 'Name', email: 'a@b.co', summary: 'Summary' },
      experiences: [
        { jobTitle: 'Job', company: 'Co', startDate: '2020-01', isCurrent: true },
      ],
      skills: [{ name: 'S'.repeat(limit) }],
    };
    expect(createCvSchema.safeParse(payload).success).toBe(true);

    expect(await columnWidth('cv_skills', 'name')).toBeGreaterThanOrEqual(limit);
  });

  it('stores a summary as long as the API accepts', async () => {
    const limit = 2000;
    const payload = {
      personal: { fullName: 'Name', email: 'a@b.co', summary: 'S'.repeat(limit) },
      experiences: [
        { jobTitle: 'Job', company: 'Co', startDate: '2020-01', isCurrent: true },
      ],
      skills: [{ name: 'Skill' }],
    };
    expect(createCvSchema.safeParse(payload).success).toBe(true);

    // summary is TEXT, whose declared maximum is far above the API limit.
    expect(await columnWidth('cvs', 'summary')).toBeGreaterThanOrEqual(limit);
  });
});

describe('migrate protects existing data', () => {
  async function withConnection(fn: (pool: Pool) => Promise<void>): Promise<void> {
    const pool = createServerPool(config.db.database);
    try {
      await fn(pool);
    } finally {
      await pool.end();
    }
  }

  /** Simulate drift behind the migration's back. Only safe while `users` is empty. */
  async function narrowUsersFullName(width: number): Promise<void> {
    await withConnection(async (pool) => {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query(`ALTER TABLE users MODIFY full_name VARCHAR(${width}) NOT NULL`);
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    });
  }

  /** Populate a table that the rebuild would otherwise destroy. */
  async function insertCvRow(): Promise<void> {
    await execute('INSERT INTO cvs (full_name, email) VALUES (?, ?)', [
      'Keep This Person',
      'keep@example.com',
    ]);
  }

  async function cvRowCount(): Promise<number> {
    const [rows] = await createServerPool(config.db.database).query<
      Array<RowDataPacket & { total: number }>
    >('SELECT COUNT(*) AS total FROM cvs');
    return Number(rows[0]?.total ?? 0);
  }

  it('is a no-op when the schema already matches', async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });

  it('refuses to drop populated tables when drift is detected', async () => {
    await narrowUsersFullName(4);
    await insertCvRow();

    await expect(migrate()).rejects.toThrow(/Refusing to drop the existing tables/);
    expect(await cvRowCount()).toBe(1);

    await narrowUsersFullName(120);
    await expect(migrate()).resolves.toBeUndefined();
  });

  it('recreates drifted tables when the caller forces it', async () => {
    await narrowUsersFullName(4);
    await insertCvRow();

    await expect(migrate({ force: true })).resolves.toBeUndefined();

    expect(await cvRowCount()).toBe(0);
    expect(await columnWidth('users', 'full_name')).toBe(120);
  });
});
