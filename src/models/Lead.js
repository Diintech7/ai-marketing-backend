import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    phoneNumbers: [{ type: String, trim: true }],
    emails: [{ type: String, trim: true, lowercase: true }],
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    rating: { type: String, default: null },
    website: { type: String, trim: true },
    sources: [{ type: String, trim: true }], // e.g., 'google', 'justdial'
    description: { type: String, trim: true },
    pitchSuggestion: { type: String, trim: true },
    leadQuality: { type: String, enum: ["Hot", "Warm", "Cold", "Unknown"], default: "Unknown" },
    salesStatus: { type: String, enum: ["New", "Contacted", "Follow-up", "Closed"], default: "New" },
    searchQueryId: { type: mongoose.Schema.Types.ObjectId, ref: "LeadSearchQuery" }
  },
  { timestamps: true }
);

// Index for faster deduplication lookups
leadSchema.index({ phoneNumbers: 1 });
leadSchema.index({ businessName: 1, pincode: 1 });

const Lead = mongoose.model("Lead", leadSchema);
export default Lead;
