import express from "express";
import { generateLeads, getLeads, getQueryStatus, analyzeLead, saveExtensionLeads, checkScrapeHistory, logScrapeHistory, getMissingWebsiteLeads, updateLeadWebsite } from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.js"; // Using existing auth middleware

const router = express.Router();

// Public routes for Chrome Extension (Since it doesn't have the React JWT token)
router.post("/extension", saveExtensionLeads);
router.post("/history/check", checkScrapeHistory);
router.post("/history/log", logScrapeHistory);
router.get("/missing-websites", getMissingWebsiteLeads);
router.post("/update-website", updateLeadWebsite);

router.use(protect); // Ensure only authenticated users can generate/view leads

router.post("/generate", generateLeads);
router.get("/", getLeads);
router.get("/status/:queryId", getQueryStatus);
router.put("/:id/analyze", analyzeLead);

export default router;
