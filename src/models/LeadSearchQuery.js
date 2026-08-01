import mongoose from "mongoose";

const leadSearchQuerySchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true, trim: true, lowercase: true },
    location: { type: String, required: true, trim: true, lowercase: true },
    pincode: { type: String, trim: true },
    platforms: [{ type: String, trim: true }],
    lastScrapedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "scraping", "completed", "failed"],
      default: "pending",
    },
    totalLeadsFound: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index to quickly find recent identical queries
leadSearchQuerySchema.index({ keyword: 1, location: 1, pincode: 1 });

const LeadSearchQuery = mongoose.model("LeadSearchQuery", leadSearchQuerySchema);
export default LeadSearchQuery;
