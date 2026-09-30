import { Router } from 'express';
import { pingDatabase } from '../db/pool.js';
import { config } from '../config/env.js';
import { authRouter } from './auth.routes.js';
import { cvRouter } from './cv.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  const startedAt = Date.now();
  let database: 'up' | 'down' = 'up';

  try {
    await pingDatabase();
  } catch {
    database = 'down';
  }

  res.status(database === 'up' ? 200 : 503).json({
    data: {
      status: database === 'up' ? 'ok' : 'degraded',
      environment: config.env,
      database,
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/cvs', cvRouter);
