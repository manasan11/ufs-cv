import type { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../db/pool.js';
import type { AuthUser } from '../types/cv.js';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  created_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: toIso(row.created_at),
  };
}

export async function findUserByEmail(
  email: string,
  withPassword: false,
): Promise<AuthUser | null>;
export async function findUserByEmail(
  email: string,
  withPassword: true,
): Promise<(AuthUser & { passwordHash: string }) | null>;
export async function findUserByEmail(email: string, withPassword = false) {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  if (!row) return null;

  const user = toAuthUser(row);
  return withPassword ? { ...user, passwordHash: row.password_hash } : user;
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  return row ? toAuthUser(row) : null;
}

export async function insertUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
}): Promise<number> {
  const result = await execute(
    'INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)',
    [input.email, input.passwordHash, input.fullName],
  );
  return result.insertId;
}
