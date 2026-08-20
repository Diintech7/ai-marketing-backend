import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { connectMeta, disconnectMeta, getMetaAccount, getAccountInsights, uploadCustomAudience } from "../controllers/meta.controller.js";

const router = Router();
router.use(protect);

router.post("/connect", connectMeta);
router.delete("/disconnect", disconnectMeta);
router.get("/account", getMetaAccount);
router.get("/insights", getAccountInsights);
router.post("/custom-audience", uploadCustomAudience);

export default router;
