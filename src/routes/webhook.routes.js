import express from "express";
import { 
  verifyMetaWebhook, 
  handleMetaLead, 
  handleGoogleLead 
} from "../controllers/webhook.controller.js";

const router = express.Router();

// ==========================================
// Meta (Facebook) Webhooks
// ==========================================

// GET route for Facebook Webhook Verification (hub.challenge)
router.get("/meta", verifyMetaWebhook);

// POST route for actual Facebook Leadgen events
router.post("/meta", handleMetaLead);


// ==========================================
// Google Ads Webhooks
// ==========================================

// POST route for Google Lead Form Extensions
router.post("/google", handleGoogleLead);


export default router;
