import { Router } from "express";
import { verifyApiKey } from "../middleware/apiKeyAuth.js";
import { requestTracker } from "../middleware/requestTracker.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { ROLES } from "../constants/index.js";
import * as ctrl from "../controllers/external.controller.js";

const router = Router();

// ── Request tracking on all external routes ────────────────────
router.use(requestTracker);

// ── Public Partner Routes (API Key protected) ─────────────────
router.use("/partner", verifyApiKey);

router.post("/partner/campaigns/launch",   ctrl.launchCampaign);          // Create & publish ad
router.get("/partner/campaign-status/:id", ctrl.getCampaignStatus);       // Check campaign status
router.post("/partner/campaigns/:id/pause", ctrl.pauseCampaign);          // Pause ad
router.post("/partner/campaigns/:id/resume", ctrl.resumeCampaign);        // Resume ad
router.delete("/partner/campaigns/:id",    ctrl.deleteCampaign);          // Delete ad
router.post("/partner/sync-client",        ctrl.syncClient);              // Register external client
router.get("/partner/clients",             ctrl.getClients);              // Get list of synced clients (admin only)
router.get("/partner/clients/:clientId/campaigns", ctrl.getClientCampaigns); // Get list of client campaigns (admin only)
router.get("/partner/clients/:clientId/analytics-summary", ctrl.getClientAnalyticsSummary); // Get platform analytics summary (admin only)
router.get("/partner/activities",          ctrl.getActivityLogs);         // Fetch logs with filters
router.put("/partner/webhook-url",         ctrl.updateWebhookUrl);        // Set webhook URL

// ── Admin-only Routes (JWT protected) ─────────────────────────
router.use("/admin-api", protect, restrictTo(ROLES.ADMIN, ROLES.SUPERADMIN));

router.post("/admin-api/generate-key", ctrl.generateApiKey);  // Admin generates key for a user
router.post("/admin-api/revoke-key",   ctrl.revokeApiKey);    // Admin revokes a key
router.get("/admin-api/activities",    ctrl.getAdminActivityLogs); // Admin gets logs for all assigned clients

export default router;
