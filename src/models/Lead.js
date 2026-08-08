import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    phoneNumbers: [{ type: String, trim: true }],
    emails: [{ type: String, trim: true, lowercase: true }],
    website: { type: String, trim: true },
    
    // Location Details
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: "India", trim: true },
    pincode: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    gridId: { type: String, trim: true }, // Which cell it was scraped from

    // Extra Details
    rating: { type: String, default: null },
    reviewsCount: { type: Number, default: 0 },
    openingHours: { type: String, trim: true },
    googleMapsUrl: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    socialLinks: [{ type: String, trim: true }],
    scrapedAt: { type: Date, default: Date.now },
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
