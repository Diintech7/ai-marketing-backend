import { Router } from "express";
import { launchCampaign } from "../controllers/external.controller.js";
import { verifyApiKey } from "../middleware/apiKeyAuth.js";

const router = Router();

// Protect all external routes with API Key
router.use(verifyApiKey);

// Launch Ad
router.post("/campaigns/launch", launchCampaign);

export default router;
