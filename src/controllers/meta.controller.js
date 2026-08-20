import User from "../models/User.js";
import MetaService from "../services/meta.service.js";
import { successResponse } from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";

// POST /api/meta/connect  { accessToken, adAccountId }
export const connectMeta = async (req, res, next) => {
  try {
    const { accessToken, adAccountId } = req.body;
    if (!accessToken || !adAccountId)
      throw new AppError("accessToken and adAccountId are required", 400);

    // Verify token works
    await MetaService.getAdAccount(accessToken, adAccountId);

    await User.findByIdAndUpdate(req.user._id, {
      metaAccessToken: accessToken,
      metaAdAccountId: adAccountId,
    });

    successResponse(res, {}, "Meta account connected successfully");
  } catch (err) { next(err); }
};

// DELETE /api/meta/disconnect
export const disconnectMeta = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      metaAccessToken: null,
      metaAdAccountId: null,
    });
    successResponse(res, {}, "Meta account disconnected");
  } catch (err) { next(err); }
};

// GET /api/meta/account
export const getMetaAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+metaAccessToken");
    const accessToken = user?.metaAccessToken || process.env.META_ACCESS_TOKEN;
    const adAccountId = user?.metaAdAccountId || process.env.META_AD_ACCOUNT_ID;
    if (!accessToken) throw new AppError("Meta account not connected", 400);
    const account = await MetaService.getAdAccount(accessToken, adAccountId);
    successResponse(res, account);
  } catch (err) { next(err); }
};

// GET /api/meta/insights
export const getAccountInsights = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+metaAccessToken");
    const accessToken = user?.metaAccessToken || process.env.META_ACCESS_TOKEN;
    const adAccountId = user?.metaAdAccountId || process.env.META_AD_ACCOUNT_ID;
    if (!accessToken) throw new AppError("Meta account not connected", 400);
    const insights = await MetaService.getAccountInsights(
      accessToken,
      adAccountId,
      req.query.dateRange || "last_30d"
    );
    successResponse(res, insights);
  } catch (err) { next(err); }
};

// POST /api/meta/custom-audience
export const uploadCustomAudience = async (req, res, next) => {
  try {
    const { name, description, users } = req.body;
    if (!name || !users || !Array.isArray(users)) {
      throw new AppError("Name and users array are required", 400);
    }

    const user = await User.findById(req.user._id).select("+metaAccessToken");
    const accessToken = user?.metaAccessToken || process.env.META_ACCESS_TOKEN;
    const adAccountId = user?.metaAdAccountId || process.env.META_AD_ACCOUNT_ID;
    if (!accessToken) throw new AppError("Meta account not connected", 400);

    // 1. Create empty Custom Audience on Meta
    const audience = await MetaService.createCustomAudience(
      accessToken,
      adAccountId,
      name,
      description
    );
    const audienceId = audience.id;

    // 2. Format and SHA-256 Hash the user details
    const crypto = await import("crypto");
    const hashSHA256 = (val) => {
      if (!val) return "";
      return crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");
    };

    const formattedData = users.map(u => [
      hashSHA256(u.email),
      hashSHA256(u.phone)
    ]).filter(row => row[0] || row[1]); // Filter out empty entries

    // 3. Upload in batches of 10,000
    const BATCH_SIZE = 10000;
    const schema = ["EMAIL", "PHONE"];

    for (let i = 0; i < formattedData.length; i += BATCH_SIZE) {
      const batch = formattedData.slice(i, i + BATCH_SIZE);
      await MetaService.addUsersToCustomAudience(
        accessToken,
        audienceId,
        schema,
        batch
      );
    }

    successResponse(res, { audienceId }, "Custom Audience created and populated successfully!");
  } catch (err) { next(err); }
};
