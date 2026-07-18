import AnalyticsService from "../services/analytics.service.js";
import { successResponse } from "../utils/apiResponse.js";

export const getOverview = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getOverview(req.user._id);
    successResponse(res, data, "Analytics overview fetched");
  } catch (err) { next(err); }
};

export const getCampaignPerformance = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getCampaignPerformance(req.user._id, req.query.limit);
    successResponse(res, data, "Campaign performance fetched");
  } catch (err) { next(err); }
};

export const getAIUsageByTool = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getAIUsageByTool(req.user._id);
    successResponse(res, data, "AI usage by tool fetched");
  } catch (err) { next(err); }
};

export const getAIUsageTrend = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getAIUsageTrend(req.user._id);
    successResponse(res, data, "AI usage trend fetched");
  } catch (err) { next(err); }
};

export const getCampaignTrend = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getCampaignTrend(req.user._id);
    successResponse(res, data, "Campaign trend fetched");
  } catch (err) { next(err); }
};

export const getTopCampaigns = async (req, res, next) => {
  try {
    const data = await AnalyticsService.getTopCampaigns(req.user._id, req.query.metric, req.query.limit);
    successResponse(res, data, "Top campaigns fetched");
  } catch (err) { next(err); }
};
