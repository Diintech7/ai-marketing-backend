import { Router } from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { createCampaignValidator, updateBudgetValidator } from "../validators/campaign.validator.js";
import * as ctrl from "../controllers/campaign.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadLarge = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.use(protect);

router.post("/upload-image", upload.single("image"), ctrl.uploadImage);
router.post("/upload-video", uploadLarge.single("video"), ctrl.uploadVideo);
router.get("/", ctrl.getAll);
router.post("/", createCampaignValidator, ctrl.create);
router.get("/:id", ctrl.getOne);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/publish", ctrl.publish);
router.post("/:id/pause", ctrl.pause);
router.post("/:id/resume", ctrl.resume);
router.patch("/:id/budget", updateBudgetValidator, ctrl.updateBudget);
router.get("/:id/insights", ctrl.syncInsights);
router.get("/:id/sync-status", ctrl.syncStatus);

export default router;
