import mongoose from "mongoose";

const emailRecipientSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "EmailCampaign", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["pending", "sent", "failed"], 
      default: "pending",
      index: true
    },
    error: { type: String }, // To store bounce reason if any
    sentAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("EmailRecipient", emailRecipientSchema);
