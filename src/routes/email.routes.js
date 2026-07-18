import { Router } from "express";
import { protect } from "../middleware/auth.js";
import * as ctrl from "../controllers/email.controller.js";

const router = Router();
router.use(protect);

router.post("/", ctrl.createCampaign);
router.get("/", ctrl.getCampaigns);
router.put("/:id/publish", ctrl.publishCampaign);

export default router;
