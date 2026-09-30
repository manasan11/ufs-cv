import type { Request, Response } from 'express';
import { config } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { findUserById } from '../repositories/user.repository.js';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import type { LoginInput, RegisterInput } from '../validation/schemas.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body as RegisterInput);
  res.status(201).json({ data: result });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);
  res.json({ data: result });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  const record = await findUserById(user.id);
  if (!record) throw ApiError.unauthorized('The account for this token no longer exists');

  res.json({ data: record });
});

export const authConfig = (_req: Request, res: Response) => {
  res.json({
    data: {
      authRequired: config.authRequired,
      registrationOpen: true,
    },
  });
};

export const requireAuthMiddleware = requireAuth;
