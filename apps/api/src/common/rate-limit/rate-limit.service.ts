import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/configuration';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * A fixed window rate limiter that lives in the process.
 *
 * It protects the login and invitation endpoints against brute force. A shared store (Redis)
 * is only needed when the API runs with more than one instance — that trade-off is documented
 * in `docs/architecture.md`.
 */
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  check(key: string, limit: number, windowSeconds: number): RateLimitDecision {
    if (!this.config.rateLimit.enabled) {
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      this.prune(now);
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
    }

    bucket.count += 1;
    const remaining = Math.max(0, limit - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return { allowed: bucket.count <= limit, remaining, retryAfterSeconds };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
