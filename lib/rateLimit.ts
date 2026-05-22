// lib/rateLimit.ts
// Rate limiting utility for API endpoints
// In-memory implementation for development; use Redis for production

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client identifier from request
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  
  // Add user agent to differentiate different browsers on same IP
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  return `${ip}:${userAgent}`;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Check if request should be rate limited
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  cleanupExpiredEntries();
  
  const now = Date.now();
  const entry = rateLimitStore.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(clientId, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(clientId, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limiting middleware helper for API routes
 */
export async function rateLimitMiddleware(
  request: Request,
  config: RateLimitConfig
): Promise<{ allowed: boolean; error?: string }> {
  const clientId = getClientId(request);
  const result = checkRateLimit(clientId, config);
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Pre-configured rate limits for different endpoint types
 */
export const RATE_LIMITS = {
  // Auth endpoints - strict limits to prevent brute force
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 requests per minute
  },
  
  // Sign up - even stricter
  signup: {
    maxRequests: 3,
    windowMs: 60 * 1000, // 3 requests per minute
  },
  
  // API endpoints - moderate limits
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  },
  
  // Monitoring endpoints - higher limits
  monitoring: {
    maxRequests: 300,
    windowMs: 60 * 1000, // 300 requests per minute
  },
} as const;
