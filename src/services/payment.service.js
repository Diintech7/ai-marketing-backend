import Razorpay from "razorpay";
import crypto from "crypto";
import paymentRepo from "../repositories/payment.repository.js";
import subscriptionRepo from "../repositories/subscription.repository.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { PLANS, PLAN_PRICES, PLAN_CREDITS } from "../constants/index.js";

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder",
});

const PAID_PLANS = [PLANS.STARTER, PLANS.PRO, PLANS.BUSINESS];

const PaymentService = {
  // ─── Create Order ────────────────────────────────────────────
  createOrder: async (userId, plan) => {
    if (!PAID_PLANS.includes(plan))
      throw new AppError("Invalid plan selected", 400);

    const amount = PLAN_PRICES[plan];

    const order = await getRazorpay().orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${userId}_${Date.now()}`,
      notes: { userId: userId.toString(), plan },
    });

    // Save pending payment record
    await paymentRepo.create({
      user: userId,
      razorpayOrderId: order.id,
      plan,
      amount,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  },

  // ─── Verify Payment & Activate Subscription ──────────────────
  verifyPayment: async (userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    // Signature verification
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature)
      throw new AppError("Payment verification failed", 400);

    const payment = await paymentRepo.findByOrderId(razorpayOrderId);
    if (!payment) throw new AppError("Order not found", 404);
    if (payment.user.toString() !== userId.toString())
      throw new AppError("Unauthorized", 403);

    // Update payment record
    await paymentRepo.updateById(payment._id, {
      razorpayPaymentId,
      razorpaySignature,
      status: "paid",
    });

    // Activate subscription
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await subscriptionRepo.upsertByUser(userId, {
      plan: payment.plan,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    // Update user plan + reset credits
    await User.findByIdAndUpdate(userId, {
      plan: payment.plan,
      credits: PLAN_CREDITS[payment.plan],
      subscriptionStatus: "active",
    });

    return { plan: payment.plan, message: "Subscription activated successfully" };
  },

  // ─── Razorpay Webhook ─────────────────────────────────────────
  handleWebhook: async (rawBody, signature) => {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature)
      throw new AppError("Invalid webhook signature", 400);

    const event = JSON.parse(rawBody);
    const { event: eventType, payload } = event;

    if (eventType === "payment.failed") {
      const orderId = payload.payment.entity.order_id;
      await paymentRepo.updateById(
        (await paymentRepo.findByOrderId(orderId))?._id,
        { status: "failed" }
      );
    }

    return { received: true };
  },

  // ─── Cancel Subscription ──────────────────────────────────────
  cancel: async (userId) => {
    const sub = await subscriptionRepo.findByUser(userId);
    if (!sub || sub.status !== "active")
      throw new AppError("No active subscription found", 400);

    await subscriptionRepo.upsertByUser(userId, {
      status: "cancelled",
      cancelledAt: new Date(),
    });

    await User.findByIdAndUpdate(userId, {
      plan: PLANS.FREE,
      credits: PLAN_CREDITS.free,
      subscriptionStatus: "cancelled",
    });

    return { message: "Subscription cancelled. You have been moved to the Free plan." };
  },

  // ─── Get Subscription ─────────────────────────────────────────
  getSubscription: async (userId) => {
    const sub = await subscriptionRepo.findByUser(userId);
    return sub || { plan: PLANS.FREE, status: "inactive" };
  },

  // ─── Payment History ──────────────────────────────────────────
  getHistory: async (userId, { limit = 10, skip = 0 } = {}) => {
    return paymentRepo.findByUser(userId, { limit: Number(limit), skip: Number(skip) });
  },
};

export default PaymentService;
