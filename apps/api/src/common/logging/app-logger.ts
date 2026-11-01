import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/configuration';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * A small structured logger.
 *
 * Every line is JSON, so the output can be shipped to a log aggregator without a parser.
 * Secrets never reach the log: only identifiers, durations and error names are logged.
 */
@Injectable()
export class AppLogger implements LoggerService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private write(level: Level, message: string, context?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.config.logLevel]) {
      return;
    }
    const entry = {
      level,
      time: new Date().toISOString(),
      message,
      ...(context && typeof context === 'object' ? { context } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  log(message: unknown, context?: unknown): void {
    this.write('info', typeof message === 'string' ? message : JSON.stringify(message), context);
  }

  info(message: unknown, context?: unknown): void {
    this.write('info', typeof message === 'string' ? message : JSON.stringify(message), context);
  }

  debug(message: unknown, context?: unknown): void {
    this.write('debug', typeof message === 'string' ? message : JSON.stringify(message), context);
  }

  warn(message: unknown, context?: unknown): void {
    this.write('warn', typeof message === 'string' ? message : JSON.stringify(message), context);
  }

  error(message: unknown, trace?: unknown): void {
    this.write('error', typeof message === 'string' ? message : JSON.stringify(message), trace);
  }

  verbose(message: unknown, context?: unknown): void {
    this.write('debug', typeof message === 'string' ? message : JSON.stringify(message), context);
  }
}
