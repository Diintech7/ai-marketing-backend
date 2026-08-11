import { Router } from "express";
import { login, getMe } from "../controllers/extensionAuth.controller.js";
import { protectExtension } from "../middleware/extensionAuth.middleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", protectExtension, getMe);

export default router;
