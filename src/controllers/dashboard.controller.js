import campaignRepo from "../repositories/campaign.repository.js";
import aiUsageRepo from "../repositories/aiusage.repository.js";
import { successResponse } from "../utils/apiResponse.js";

export const getStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [totalCampaigns, runningAds, usageResult] = await Promise.all([
      campaignRepo.countByUser(userId),
      campaignRepo.countActiveByUser(userId),
      aiUsageRepo.totalCreditsUsed(userId),
    ]);

    successResponse(res, {
      totalCampaigns,
      runningAds,
      totalSpend: 0, // will come from Meta Insights in Phase 6
      credits: req.user.credits,
      creditsUsed: usageResult[0]?.total || 0,
    });
  } catch (err) { next(err); }
};

export const getRecentCampaigns = async (req, res, next) => {
  try {
    const campaigns = await campaignRepo.findByUser(req.user._id, { limit: 5 });
    successResponse(res, campaigns);
  } catch (err) { next(err); }
};

export const getActivity = async (req, res, next) => {
  try {
    const activity = await aiUsageRepo.findByUser(req.user._id, { limit: 10 });
    successResponse(res, activity);
  } catch (err) { next(err); }
};
