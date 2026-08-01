import express from "express";
import { generateLeads, getLeads, getQueryStatus, analyzeLead } from "../controllers/lead.controller.js";
import { protect } from "../middleware/auth.js"; // Using existing auth middleware

const router = express.Router();

router.use(protect); // Ensure only authenticated users can generate/view leads

router.post("/generate", generateLeads);
router.get("/", getLeads);
router.get("/status/:queryId", getQueryStatus);
router.put("/:id/analyze", analyzeLead);

export default router;
