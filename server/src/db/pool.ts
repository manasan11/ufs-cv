import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createPool, type Pool, type PoolConnection, type PoolOptions } from 'mysql2/promise';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const options: PoolOptions = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  timezone: 'Z',
  dateStrings: ['DATE'],
  supportBigNumbers: true,
  bigNumberStrings: false,
  namedPlaceholders: false,
};

export const pool: Pool = createPool(options);

/** Values accepted as positional query parameters. */
export type SqlParam = string | number | boolean | null | Date | Buffer;

export type SqlParams = ReadonlyArray<SqlParam>;

/** Pool used before the application database exists (migration/seed). */
export function createServerPool(database?: string): Pool {
  return createPool({ ...options, database });
}

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = [],
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, [...params]);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: SqlParams = [],
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: SqlParams = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, [...params]);
  return result;
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export async function withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase(): Promise<number> {
  const startedAt = process.hrtime.bigint();
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
