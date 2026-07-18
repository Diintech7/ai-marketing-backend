import { body } from "express-validator";
import { validate } from "./auth.validator.js";
import { PLANS } from "../constants/index.js";

export const validateCreateOrder = [
  body("plan")
    .isIn([PLANS.STARTER, PLANS.PRO, PLANS.BUSINESS])
    .withMessage("Invalid plan. Choose starter, pro, or business"),
  validate,
];

export const validateVerifyPayment = [
  body("razorpayOrderId").notEmpty().withMessage("Order ID is required"),
  body("razorpayPaymentId").notEmpty().withMessage("Payment ID is required"),
  body("razorpaySignature").notEmpty().withMessage("Signature is required"),
  validate,
];
