import mongoose from "mongoose";

const emailCampaignSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }, // HTML content
    status: { 
      type: String, 
      enum: ["draft", "active", "completed"], 
      default: "draft" 
    },
    totalRecipients: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("EmailCampaign", emailCampaignSchema);
