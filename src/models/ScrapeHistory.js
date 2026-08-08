import mongoose from "mongoose";

const scrapeHistorySchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    platforms: [{ type: String }],
    status: { type: String, enum: ["Processing", "Completed", "Failed"], default: "Processing" },
    leadsFound: { type: Number, default: 0 },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index to quickly find if a category+pincode was scraped recently
scrapeHistorySchema.index({ category: 1, pincode: 1 });

const ScrapeHistory = mongoose.model("ScrapeHistory", scrapeHistorySchema);
export default ScrapeHistory;
