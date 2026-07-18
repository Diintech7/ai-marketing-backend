import mongoose from "mongoose";
import { PLANS } from "../constants/index.js";

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.FREE },
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "expired", "past_due"],
      default: "inactive",
    },
    razorpaySubscriptionId: { type: String, default: null },
    razorpayCustomerId: { type: String, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
