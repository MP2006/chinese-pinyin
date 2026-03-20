/**
 * Rate limiter with Upstash Redis support and in-memory fallback.
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars are set,
 * uses Upstash Redis for distributed rate limiting across serverless instances.
 * Otherwise, falls back to an in-memory sliding-window implementation.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(
  maxRequests: number,
  windowMs: number
): Ratelimit {
  const key = `${maxRequests}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: redis!,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      })
    );
  }
  return limiters.get(key)!;
}

function rateLimitInMemory(
  key: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number }
): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { timestamps: [now] });
    return { limited: false, retryAfter: 0 };
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { limited: true, retryAfter };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfter: 0 };
}

export async function rateLimit(
  key: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number }
): Promise<{ limited: boolean; retryAfter: number }> {
  if (!redis) {
    return rateLimitInMemory(key, { maxRequests, windowMs });
  }

  const limiter = getUpstashLimiter(maxRequests, windowMs);
  const { success, reset } = await limiter.limit(key);

  if (success) return { limited: false, retryAfter: 0 };

  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return { limited: true, retryAfter: Math.max(retryAfter, 1) };
}

/** Visible for testing — clears all in-memory rate limit state */
export function _resetStore(): void {
  store.clear();
}
