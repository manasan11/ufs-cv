import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';
import { findUserByEmail, findUserById, insertUser } from '../repositories/user.repository.js';
import type { AuthResult, AuthUser } from '../types/cv.js';
import type { LoginInput, RegisterInput } from '../validation/schemas.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 10;

function issue(user: AuthUser): AuthResult {
  return {
    token: signToken({ sub: user.id, email: user.email }),
    user,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await findUserByEmail(input.email, false);
  if (existing) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const id = await insertUser({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
  });

  const user = await findUserById(id);
  if (!user) throw ApiError.internal('Failed to load the created account');

  logger.info(`Registered user ${user.email}`);
  return issue(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(input.email, true);
  if (!user) {
    // Spend comparable time on unknown emails to avoid user enumeration.
    await bcrypt.compare(input.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw ApiError.unauthorized('Invalid email or password');
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');

  return issue(user);
}
