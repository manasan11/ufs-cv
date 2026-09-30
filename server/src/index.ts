import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { closePool, pingDatabase } from './db/pool.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const latency = await pingDatabase();
    logger.info(`Database reachable at ${config.db.host}:${config.db.port} (${latency.toFixed(1)}ms)`);
  } catch (error) {
    logger.error('Cannot reach the database - run `npm run migrate` first', error);
    process.exit(1);
  }

  const server = createServer(createApp());

  server.listen(config.port, () => {
    logger.info(`API listening on http://localhost:${config.port}`);
    logger.info(`Environment: ${config.env} | AUTH_REQUIRED=${config.authRequired}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void closePool().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('Fatal startup error', error);
  process.exit(1);
});
