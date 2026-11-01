import { randomBytes } from 'node:crypto';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  databaseUrl: string;
  apiPrefix: string;
  corsOrigins: string[];
  cookie: {
    name: string;
    csrfName: string;
    sameSite: 'lax' | 'strict' | 'none';
    secure: boolean;
  };
  session: {
    ttlDays: number;
    secret: string;
  };
  storage: {
    driver: 'local' | 's3';
    dir: string;
    maxUploadBytes: number;
    s3: {
      endpoint?: string;
      region: string;
      bucket?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
  };
  rateLimit: {
    enabled: boolean;
    windowSeconds: number;
    maxRequests: number;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true' || value === '1';
}

/**
 * Reads the configuration from the environment.
 *
 * In production every secret has to be present; in development a random session secret is
 * generated, which invalidates sessions on restart but keeps local work frictionless.
 */
export function configuration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const sessionSecret = env.SESSION_SECRET;
  if (isProduction && !sessionSecret) {
    throw new Error('SESSION_SECRET has to be set in production');
  }

  return {
    nodeEnv,
    isProduction,
    isTest,
    port: intFromEnv(env.PORT, 4000),
    databaseUrl:
      env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/teamflow?schema=public',
    apiPrefix: 'api/v1',
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    cookie: {
      name: env.SESSION_COOKIE_NAME ?? 'tf_session',
      csrfName: env.CSRF_COOKIE_NAME ?? 'tf_csrf',
      sameSite: (env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
      secure: boolFromEnv(env.COOKIE_SECURE, isProduction),
    },
    session: {
      ttlDays: intFromEnv(env.SESSION_TTL_DAYS, 30),
      secret: sessionSecret ?? randomBytes(32).toString('hex'),
    },
    storage: {
      driver: (env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
      dir: env.STORAGE_DIR ?? 'var/uploads',
      maxUploadBytes: intFromEnv(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024),
      s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION ?? 'us-east-1',
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    },
    rateLimit: {
      enabled: boolFromEnv(env.RATE_LIMIT_ENABLED, !isTest),
      windowSeconds: intFromEnv(env.RATE_LIMIT_WINDOW_SECONDS, 60),
      maxRequests: intFromEnv(env.RATE_LIMIT_MAX_REQUESTS, 120),
    },
    logLevel: (env.LOG_LEVEL as AppConfig['logLevel']) ?? 'info',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
