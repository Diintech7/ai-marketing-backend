import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES, PLANS, PLAN_CREDITS } from "../constants/index.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    company: { type: String, default: "", trim: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    avatar: { type: String, default: "" },

    // Email Verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },

    // Password Reset
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Subscription
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.FREE },
    credits: { type: Number, default: PLAN_CREDITS.free },
    subscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "cancelled", "expired"],
      default: "inactive",
    },

    // Meta Integration
    metaAccessToken: { type: String, select: false, default: null },
    metaAdAccountId: { type: String, default: null },

    // Google Ads Integration
    googleAdsCustomerId:    { type: String, default: null },
    googleAdsRefreshToken:  { type: String, select: false, default: null },
    googleAdsDeveloperToken:{ type: String, select: false, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
