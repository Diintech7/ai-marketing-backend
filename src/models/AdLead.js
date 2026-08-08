import mongoose from "mongoose";

const adLeadSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    platform: { type: String, enum: ["meta", "google"], required: true },
    
    // Platform Specific Identifiers
    leadId: { type: String, required: true, unique: true }, // leadgen_id for Meta, google_lead_id for Google
    formId: { type: String },
    adId: { type: String },
    adsetId: { type: String },

    // Standard Extracted Fields
    fullName: { type: String, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phoneNumber: { type: String, trim: true },
    city: { type: String, trim: true },
    companyName: { type: String, trim: true },

    // Dynamic/Custom Questions
    customAnswers: [
      {
        question: { type: String },
        answer: { type: String }
      }
    ],

    // Complete Payload for debugging
    rawPayload: { type: mongoose.Schema.Types.Mixed },

    // Status tracking for CRM
    status: { 
      type: String, 
      enum: ["New", "Contacted", "Follow-up", "Converted", "Junk"], 
      default: "New" 
    },
    notes: { type: String }
  },
  { timestamps: true }
);

// Indexes for fast lookup by User or Campaign
adLeadSchema.index({ userId: 1, createdAt: -1 });
adLeadSchema.index({ campaignId: 1, createdAt: -1 });

const AdLead = mongoose.model("AdLead", adLeadSchema);
export default AdLead;
