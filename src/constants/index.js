export const ROLES = { ADMIN: "admin", USER: "user" };

export const PLANS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  BUSINESS: "business",
};

export const PLAN_CREDITS = {
  free: 50,
  starter: 500,
  pro: 2000,
  business: 10000,
};

export const PLAN_PRICES = {
  free: 0,
  starter: 99900,    // ₹999 in paise
  pro: 299900,       // ₹2999 in paise
  business: 799900,  // ₹7999 in paise
};

export const PLAN_LIMITS = {
  free:     { campaigns: 2,   adSets: 2,   ads: 5,   images: 5   },
  starter:  { campaigns: 10,  adSets: 10,  ads: 30,  images: 50  },
  pro:      { campaigns: 50,  adSets: 50,  ads: 200, images: 200 },
  business: { campaigns: 999, adSets: 999, ads: 999, images: 999 },
};

export const AI_TOOL_CREDITS = {
  adCopy: 2,
  image: 5,
  marketingStrategy: 10,
  seoTitle: 1,
  seoDescription: 1,
  keywords: 2,
  hashtags: 1,
  captions: 2,
  cta: 1,
  campaignSuggestion: 5,
};

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
};
