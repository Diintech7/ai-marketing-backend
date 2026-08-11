import express from "express";
import { generateLeads, getLeads, getQueryStatus, analyzeLead, saveExtensionLeads, checkScrapeHistory, logScrapeHistory, getMissingWebsiteLeads, updateLeadWebsite } from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.js"; // Using existing auth middleware
import { protectExtension } from "../middleware/extensionAuth.middleware.js";

const router = express.Router();

// Secured routes for Chrome Extension (Now authenticated via ExtensionUser JWT)
router.post("/extension", protectExtension, saveExtensionLeads);
router.post("/history/check", protectExtension, checkScrapeHistory);
router.post("/history/log", protectExtension, logScrapeHistory);
router.get("/missing-websites", protectExtension, getMissingWebsiteLeads);
router.post("/update-website", protectExtension, updateLeadWebsite);

router.use(protect); // Ensure only authenticated users can generate/view leads

router.post("/generate", generateLeads);
router.get("/", getLeads);
router.get("/status/:queryId", getQueryStatus);
router.put("/:id/analyze", analyzeLead);

export default router;
