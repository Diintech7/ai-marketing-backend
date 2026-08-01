import express from "express";
import { getNotifications, markAsRead } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);
router.put("/read", markAsRead);

export default router;
