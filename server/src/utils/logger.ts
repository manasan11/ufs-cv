import { config } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = config.isTest ? 'error' : config.isProduction ? 'info' : 'debug';

function emit(level: Level, message: string, meta?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const timestamp = new Date().toISOString();
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  const prefix = `${timestamp} ${level.toUpperCase().padEnd(5)}`;

  if (meta === undefined) {
    stream.write(`${prefix} ${message}\n`);
    return;
  }

  if (meta instanceof Error) {
    stream.write(`${prefix} ${message} ${meta.message}\n${meta.stack ?? ''}\n`);
    return;
  }

  try {
    stream.write(`${prefix} ${message} ${JSON.stringify(meta)}\n`);
  } catch {
    stream.write(`${prefix} ${message} [unserialisable meta]\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
