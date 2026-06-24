interface RateLimitRule {
  limit: number;      // max requests
  windowMs: number;   // time window in ms
}

const ROLES_RULES: Record<string, RateLimitRule> = {
  superadmin: { limit: 120, windowMs: 60 * 1000 },
  principal: { limit: 60, windowMs: 60 * 1000 },
  staff: { limit: 60, windowMs: 60 * 1000 },
  anonymous: { limit: 30, windowMs: 60 * 1000 },
};

// Simple in-memory storage for rate limiting (sliding window)
const cache = new Map<string, number[]>();

// Periodically clean up old entries to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of cache.entries()) {
      // Keep only timestamps within the last 5 minutes (max window)
      const validTimestamps = timestamps.filter(t => now - t < 5 * 60 * 1000);
      if (validTimestamps.length === 0) {
        cache.delete(key);
      } else {
        cache.set(key, validTimestamps);
      }
    }
  }, 60 * 1000); // clean up every minute
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp in ms when limit resets
}

export function rateLimit(identifier: string, role: string = "anonymous"): RateLimitResult {
  const rule = ROLES_RULES[role] || ROLES_RULES.anonymous;
  const now = Date.now();
  const windowStart = now - rule.windowMs;

  const userLogs = cache.get(identifier) || [];
  
  // Filter out logs outside the window
  const logsInWindow = userLogs.filter(t => t > windowStart);
  
  if (logsInWindow.length >= rule.limit) {
    // Rate limit exceeded
    const oldestLog = logsInWindow[0];
    const resetTime = oldestLog + rule.windowMs;
    
    return {
      success: false,
      limit: rule.limit,
      remaining: 0,
      reset: resetTime,
    };
  }

  // Record the new request
  logsInWindow.push(now);
  cache.set(identifier, logsInWindow);

  return {
    success: true,
    limit: rule.limit,
    remaining: rule.limit - logsInWindow.length,
    reset: now + rule.windowMs,
  };
}
