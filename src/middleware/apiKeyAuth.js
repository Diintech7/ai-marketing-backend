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
    const clientApiKey = req.headers["x-api-key"];
    const partnerSecret = req.headers["x-partner-secret"];

    if (!partnerSecret) {
      throw new AppError("Partner Secret is missing. Pass it as x-partner-secret header.", 401, "ERR_MISSING_PARTNER_SECRET");
    }

    // 1. Validate Partner (Admin/SuperAdmin)
    const partnerUser = await User.findOne({ apiKeys: partnerSecret, role: { $in: ["admin", "super_admin"] } });
    if (!partnerUser) {
      throw new AppError("Invalid or revoked Partner Secret.", 401, "ERR_INVALID_PARTNER_SECRET");
    }
    if (!partnerUser.isActive) {
      throw new AppError("Partner account has been suspended.", 403, "ERR_PARTNER_SUSPENDED");
    }

    // 2. If client API Key is present, validate Client and link to Partner
    if (clientApiKey) {
      const clientUser = await User.findOne({ apiKeys: clientApiKey, role: "client" });
      if (!clientUser) {
        throw new AppError("Invalid or revoked Client API Key.", 401, "ERR_INVALID_CLIENT_KEY");
      }
      if (!clientUser.isActive) {
        throw new AppError("Client account has been suspended.", 403, "ERR_CLIENT_SUSPENDED");
      }
      if (clientUser.approvalStatus !== "approved") {
        throw new AppError(
          "Your account is pending approval or has been rejected.",
          403,
          "ERR_ACCOUNT_PENDING_APPROVAL"
        );
      }

      // Ensure Client belongs to this Partner
      if (clientUser.assignedAdmin?.toString() !== partnerUser._id.toString()) {
        throw new AppError("Access denied. Client is not assigned to this Partner.", 403, "ERR_CLIENT_ASSIGNMENT_MISMATCH");
      }

      req.user = clientUser;
      req.partner = partnerUser;
      req.apiKey = clientApiKey;
    } else {
      // Act as partner (e.g. for sync-client, webhook-url, activities)
      req.user = partnerUser;
      req.apiKey = partnerSecret;
    }

    // ── Rate Limiting (per Partner Secret) ─────────────────────────
    const now     = Date.now();
    const record  = rateLimitMap.get(partnerSecret) || { count: 0, windowStart: now };

    // Reset window if expired
    if (now - record.windowStart > WINDOW_MS) {
      record.count       = 0;
      record.windowStart = now;
    }

    record.count++;
    rateLimitMap.set(partnerSecret, record);

    const remaining = Math.max(0, RATE_LIMIT - record.count);

    // Attach rate limit headers
    res.setHeader("X-RateLimit-Limit",     RATE_LIMIT);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset",     new Date(record.windowStart + WINDOW_MS).toISOString());

    if (record.count > RATE_LIMIT) {
      throw new AppError("Rate limit exceeded. Max 60 requests per minute.", 429, "ERR_RATE_LIMIT_EXCEEDED");
    }

    // ── Credit / Wallet Header ────────────────────────────────────
    const activeUser = clientApiKey ? req.user : partnerUser;
    res.setHeader("X-Wallet-Balance", activeUser.walletBalance ?? 0);
    res.setHeader("X-Credits-Remaining", activeUser.credits ?? 0);

    next();
  } catch (error) {
    next(error);
  }
};
