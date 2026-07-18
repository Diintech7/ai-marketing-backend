import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getOverview,
  getCampaignPerformance,
  getAIUsageByTool,
  getAIUsageTrend,
  getCampaignTrend,
  getTopCampaigns,
} from "../controllers/analytics.controller.js";

const router = Router();
router.use(protect);

router.get("/overview", getOverview);
router.get("/campaigns/performance", getCampaignPerformance);
router.get("/campaigns/trend", getCampaignTrend);
router.get("/campaigns/top", getTopCampaigns);
router.get("/ai/by-tool", getAIUsageByTool);
router.get("/ai/trend", getAIUsageTrend);

export default router;
