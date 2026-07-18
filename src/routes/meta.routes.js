import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { connectMeta, disconnectMeta, getMetaAccount, getAccountInsights } from "../controllers/meta.controller.js";

const router = Router();
router.use(protect);

router.post("/connect", connectMeta);
router.delete("/disconnect", disconnectMeta);
router.get("/account", getMetaAccount);
router.get("/insights", getAccountInsights);

export default router;
