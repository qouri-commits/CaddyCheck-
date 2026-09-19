import type { RequestHandler } from "express";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  maxKeys?: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * Small, bounded, per-process limiter. It deliberately uses Express's resolved
 * client IP, so proxy trust must be configured correctly by the application.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, Entry>();
  const maxKeys = options.maxKeys ?? 10_000;

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    let entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      if (entries.size >= maxKeys) {
        for (const [candidate, value] of entries) {
          if (value.resetAt <= now || entries.size >= maxKeys) entries.delete(candidate);
          if (entries.size < maxKeys) break;
        }
      }
      entry = { count: 0, resetAt: now + options.windowMs };
      entries.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    next();
  };
}