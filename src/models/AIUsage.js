import mongoose from "mongoose";

const aiUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tool: {
      type: String,
      enum: [
        "adCopy", "image", "marketingStrategy",
        "seoTitle", "seoDescription", "keywords",
        "hashtags", "captions", "cta", "campaignSuggestion",
      ],
      required: true,
    },
    creditsUsed: { type: Number, required: true },
    prompt: { type: String, select: false },
    result: { type: String, select: false },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
  },
  { timestamps: true }
);

aiUsageSchema.index({ user: 1, createdAt: -1 });

const AIUsage = mongoose.model("AIUsage", aiUsageSchema);
export default AIUsage;
