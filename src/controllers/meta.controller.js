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
    if (!user.metaAccessToken) throw new AppError("Meta account not connected", 400);
    const account = await MetaService.getAdAccount(user.metaAccessToken, user.metaAdAccountId);
    successResponse(res, account);
  } catch (err) { next(err); }
};

// GET /api/meta/insights
export const getAccountInsights = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+metaAccessToken");
    if (!user.metaAccessToken) throw new AppError("Meta account not connected", 400);
    const insights = await MetaService.getAccountInsights(
      user.metaAccessToken,
      user.metaAdAccountId,
      req.query.dateRange || "last_30d"
    );
    successResponse(res, insights);
  } catch (err) { next(err); }
};
