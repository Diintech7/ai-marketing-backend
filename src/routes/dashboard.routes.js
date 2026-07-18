import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getStats, getRecentCampaigns, getActivity } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(protect);
router.get("/stats", getStats);
router.get("/recent-campaigns", getRecentCampaigns);
router.get("/activity", getActivity);

export default router;
