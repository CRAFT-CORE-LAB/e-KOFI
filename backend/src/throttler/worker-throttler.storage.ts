import { ThrottlerStorage } from '@nestjs/throttler';

type Entry = { hits: number[]; blockedUntil: number };

const EVICT_EVERY = 500;

/**
 * In-memory rate-limit storage that never starts a timer.
 *
 * The default ThrottlerStorageService starts its cleanup interval through a
 * function bound to the async context it was built in. On Cloudflare Workers
 * that context is the isolate's boot, so the first throttled request throws
 * "Cannot call this AsyncLocalStorage bound function outside of the request"
 * and every throttled route answers 500. Expired hits are dropped lazily here.
 */
export class WorkerThrottlerStorage implements ThrottlerStorage {
  private readonly entries = new Map<string, Entry>();
  private calls = 0;

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const now = Date.now();
    if (++this.calls % EVICT_EVERY === 0) this.evict(now);

    const id = `${throttlerName}:${key}`;
    const entry = this.entries.get(id) ?? { hits: [], blockedUntil: 0 };
    entry.hits = entry.hits.filter((expiresAt) => expiresAt > now);

    if (entry.blockedUntil <= now) {
      entry.blockedUntil = 0;
      entry.hits.push(now + ttl);
      if (entry.hits.length > limit) entry.blockedUntil = now + blockDuration;
    }
    this.entries.set(id, entry);

    return {
      totalHits: entry.hits.length,
      timeToExpire: entry.hits.length ? Math.ceil((entry.hits[0] - now) / 1000) : 0,
      isBlocked: entry.blockedUntil > now,
      timeToBlockExpire: entry.blockedUntil > now ? Math.ceil((entry.blockedUntil - now) / 1000) : 0,
    };
  }

  private evict(now: number) {
    for (const [id, entry] of this.entries) {
      if (entry.blockedUntil <= now && entry.hits.every((expiresAt) => expiresAt <= now)) {
        this.entries.delete(id);
      }
    }
  }
}
