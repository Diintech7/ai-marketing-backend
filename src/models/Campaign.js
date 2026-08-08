import mongoose from "mongoose";

const adSetSchema = new mongoose.Schema({
  metaAdSetId: { type: String, default: null },
  name: { type: String, required: true },
  targeting: {
    ageMin: { type: Number, default: 18 },
    ageMax: { type: Number, default: 65 },
    genders: [{ type: Number }], // 1=male, 2=female
    locations: [{ city: String, country: String, region: String, radius: Number, lat: Number, lng: Number }],
    interests: [{ id: String, name: String }],
  },
  budget: { type: Number, required: true }, // in paise
  budgetType: { type: String, enum: ["daily", "weekly", "monthly", "lifetime"], default: "daily" },
  status: { type: String, enum: ["active", "paused", "deleted"], default: "paused" },
});

const adSchema = new mongoose.Schema({
  metaAdId: { type: String, default: null },
  name: { type: String, required: true },
  adCopy: {
    headline: String,
    primaryText: String,
    description: String,
    cta: { type: String, default: "LEARN_MORE" },
  },
  metaAdCopy: {
    headline: String,
    primaryText: String,
    description: String,
    cta: { type: String, default: "LEARN_MORE" },
  },
  googleAdCopy: {
    headlines: [{ type: String }],
    descriptions: [{ type: String }],
    videoHeadline: String,
  },
  imageUrl: { type: String, default: null },
  thumbnailUrl: { type: String, default: null },
  link: { type: String, default: null },
  status: { type: String, enum: ["active", "paused", "deleted"], default: "paused" },
});

const campaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, default: "Diin Tech" },
    platform: { type: String, enum: ["meta", "google", "both"], default: "meta" },
    objective: {
      type: String,
      default: "TRAFFIC",
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "deleted"],
      default: "draft",
    },
    source: { type: String, enum: ["DASHBOARD", "EXTERNAL_API"], default: "DASHBOARD" },
    apiPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    runMode: { type: String, enum: ["PERSONAL", "PLATFORM"], default: "PERSONAL" },
    publishError: { type: String, default: null },
    pixelId: { type: String, default: null },
    missingRequirements: [{ type: String }],
    // Meta
    metaCampaignId: { type: String, default: null },
    // Google
    googleCampaignId:  { type: String, default: null },
    googleAdGroupId:   { type: String, default: null },
    googleAdType:      { type: String, enum: ["search", "display", "youtube", "app"], default: "search" },
    appId:             { type: String, default: null },
    appStore:          { type: String, enum: ["GOOGLE_APP_STORE", "APPLE_APP_STORE"], default: "GOOGLE_APP_STORE" },
    budget: { type: Number, required: true },
    budgetType: { type: String, enum: ["daily", "weekly", "monthly", "lifetime"], default: "daily" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    link: { type: String, default: null },
    adSets: [adSetSchema],
    ads: [adSchema],
    aiGenerated: { type: Boolean, default: false },
    aiContent: {
      hashtags: [String],
      captions: [String],
      seoTitle: [String],
      keywords: [String],
    },
    insights: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      spend: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      cpc: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

campaignSchema.index({ user: 1, status: 1 });

const Campaign = mongoose.model("Campaign", campaignSchema);
export default Campaign;
