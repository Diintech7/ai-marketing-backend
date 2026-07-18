import mongoose from "mongoose";
import { PLANS } from "../constants/index.js";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    plan: { type: String, enum: Object.values(PLANS) },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
    },
    invoiceUrl: { type: String, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
