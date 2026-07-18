import PaymentService from "../services/payment.service.js";
import { successResponse } from "../utils/apiResponse.js";

export const createOrder = async (req, res, next) => {
  try {
    const data = await PaymentService.createOrder(req.user._id, req.body.plan);
    successResponse(res, data, "Order created", 201);
  } catch (err) { next(err); }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const data = await PaymentService.verifyPayment(req.user._id, req.body);
    successResponse(res, data, "Payment verified");
  } catch (err) { next(err); }
};

export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    await PaymentService.handleWebhook(req.rawBody, signature);
    res.json({ received: true });
  } catch (err) { next(err); }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const data = await PaymentService.cancel(req.user._id);
    successResponse(res, data, "Subscription cancelled");
  } catch (err) { next(err); }
};

export const getSubscription = async (req, res, next) => {
  try {
    const data = await PaymentService.getSubscription(req.user._id);
    successResponse(res, data, "Subscription fetched");
  } catch (err) { next(err); }
};

export const getPaymentHistory = async (req, res, next) => {
  try {
    const data = await PaymentService.getHistory(req.user._id, req.query);
    successResponse(res, data, "Payment history fetched");
  } catch (err) { next(err); }
};
