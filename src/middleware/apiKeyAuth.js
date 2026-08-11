import User from "../models/User.js";
import AppError from "../utils/AppError.js";

// Simple in-memory rate limiter (per API key, per minute)
const rateLimitMap = new Map();
const RATE_LIMIT    = 60;  // max 60 requests per minute per key
const WINDOW_MS     = 60 * 1000; // 1 minute window

/**
 * verifyApiKey middleware
 * 1. Validates x-api-key header
 * 2. Enforces rate limiting (60 req/min per key)
 * 3. Attaches credit/wallet info to response headers
 */
export const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      throw new AppError("API Key is missing. Pass it as x-api-key header.", 401, "ERR_MISSING_API_KEY");
    }

    const user = await User.findOne({ apiKeys: apiKey });
    if (!user) {
      throw new AppError("Invalid or revoked API Key.", 401, "ERR_INVALID_API_KEY");
    }

    if (!user.isActive) {
      throw new AppError("Your account has been suspended. Contact admin.", 403, "ERR_ACCOUNT_SUSPENDED");
    }

    // ── Rate Limiting ─────────────────────────────────────────────
    const now     = Date.now();
    const record  = rateLimitMap.get(apiKey) || { count: 0, windowStart: now };

    // Reset window if expired
    if (now - record.windowStart > WINDOW_MS) {
      record.count       = 0;
      record.windowStart = now;
    }

    record.count++;
    rateLimitMap.set(apiKey, record);

    const remaining = Math.max(0, RATE_LIMIT - record.count);

    // Attach rate limit headers
    res.setHeader("X-RateLimit-Limit",     RATE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset",     new Date(record.windowStart + WINDOW_MS).toISOString());

    if (record.count > RATE_LIMIT) {
      throw new AppError("Rate limit exceeded. Max 60 requests per minute.", 429, "ERR_RATE_LIMIT_EXCEEDED");
    }

    // ── Credit / Wallet Header ────────────────────────────────────
    res.setHeader("X-Wallet-Balance", user.walletBalance ?? 0);
    res.setHeader("X-Credits-Remaining", user.credits ?? 0);

    // Attach user to request
    req.user   = user;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    next(error);
  }
};
