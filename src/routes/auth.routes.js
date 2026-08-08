import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", registerValidator, authController.register);
router.post("/login", loginValidator, authController.login);
router.post("/google-login", authController.googleLogin);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.get("/verify-email", authController.verifyEmail);
router.post("/forgot-password", forgotPasswordValidator, authController.forgotPassword);
router.post("/reset-password", resetPasswordValidator, authController.resetPassword);

router.get("/me", protect, authController.getMe);
router.put("/profile", protect, authController.updateProfile);
router.put("/change-password", protect, authController.changePassword);
router.post("/generate-api-key", protect, authController.generateApiKey);

export default router;
