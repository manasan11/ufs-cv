import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface TokenPayload {
  sub: number;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'number') {
    throw ApiError.unauthorized('Invalid token payload');
  }
  return { sub: decoded.sub, email: String((decoded as jwt.JwtPayload).email ?? '') };
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}

function authenticate(req: Request): AuthenticatedUser | null {
  const token = extractBearer(req);
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Rejects the request unless a valid bearer token is present. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const user = authenticate(req);
  if (!user) {
    next(ApiError.unauthorized());
    return;
  }
  req.user = user;
  next();
};

/** Attaches the user when a valid token is present, but never fails. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const user = authenticate(req);
  if (user) req.user = user;
  next();
};

/**
 * Honours AUTH_REQUIRED: when enabled, the route demands a token; when
 * disabled, an absent token is allowed but a present one is still parsed.
 */
export function authGuard(): RequestHandler {
  return config.authRequired ? requireAuth : optionalAuth;
}

export function currentUser(req: Request): AuthenticatedUser | null {
  return req.user ?? null;
}

export function ownerIdOrNull(req: Request): number | null {
  return req.user?.id ?? null;
}

export function assertCanAccess(req: Request, ownerId: number | null): void {
  if (ownerId === null) return;
  if (!req.user || req.user.id !== ownerId) {
    throw ApiError.forbidden();
  }
}

export type { NextFunction, Request, Response };
