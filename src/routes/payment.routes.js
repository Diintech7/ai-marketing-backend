import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  createOrder,
  verifyPayment,
  handleWebhook,
  cancelSubscription,
  getSubscription,
  getPaymentHistory,
} from "../controllers/payment.controller.js";
import {
  validateCreateOrder,
  validateVerifyPayment,
} from "../validators/payment.validator.js";

const router = Router();

// Webhook — no auth, raw body needed
router.post("/webhook", handleWebhook);

// Protected routes
router.use(protect);

router.post("/order", validateCreateOrder, createOrder);
router.post("/verify", validateVerifyPayment, verifyPayment);
router.get("/subscription", getSubscription);
router.delete("/subscription", cancelSubscription);
router.get("/history", getPaymentHistory);

export default router;
