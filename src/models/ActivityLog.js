import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestId:     { type: String, default: null },   // X-Request-Id UUID
    correlationId: { type: String, default: null },   // X-Correlation-Id from caller
    eventType:     {
      type: String,
      enum: [
        "CAMPAIGN_CREATED",
        "CAMPAIGN_PUBLISHED",
        "CAMPAIGN_PAUSED",
        "CAMPAIGN_FAILED",
        "CLIENT_SYNCED",
        "API_KEY_GENERATED",
        "API_KEY_REVOKED",
        "WEBHOOK_SENT",
        "WEBHOOK_FAILED",
        "ERROR_OCCURRED",
      ],
      required: true,
    },
    status:        { type: String, enum: ["success", "error"], default: "success" },
    campaignId:    { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
    errorCode:     { type: String, default: null },   // e.g. ERR_INSUFFICIENT_CREDITS
    message:       { type: String, default: null },
    meta:          { type: mongoose.Schema.Types.Mixed, default: {} }, // any extra info
  },
  { timestamps: true }
);

// Index for fast filtering by user + date
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ eventType: 1 });
activityLogSchema.index({ requestId: 1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
export default ActivityLog;
