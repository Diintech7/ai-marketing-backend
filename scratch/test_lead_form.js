import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import GoogleAdsService from "../src/services/google.service.js";

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

dotenv.config({ path: ".env" });

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://diintechteam7_db_user:Uj47L47SkMUVd4DH@adplifaidatabase.2ycgulo.mongodb.net/ai-marketing?appName=AdplifAIDatabase";
    await mongoose.connect(mongoUri);

    const campaign = await mongoose.connection.db.collection('campaigns').findOne({
      name: /AI-Powered Online Learning/i
    });

    if (!campaign) {
      console.log("No campaign found by name");
      return;
    }

    console.log("Found Campaign:", campaign.name, "googleCampaignId:", campaign.googleCampaignId);

    const user = await mongoose.connection.db.collection('users').findOne({ _id: campaign.user });
    
    const creds = {
      customerId: user.googleAdsCustomerId || process.env.GOOGLE_CUSTOMER_ID,
      refreshToken: user.googleAdsRefreshToken || process.env.GOOGLE_REFRESH_TOKEN,
      developerToken: user.googleAdsDeveloperToken || process.env.GOOGLE_DEVELOPER_TOKEN
    };

    const serverUrl = process.env.SERVER_URL || "https://ai-marketing-backend-nmoc.onrender.com";
    const webhookUrl = `${serverUrl}/api/webhooks/google`;
    const webhookKey = process.env.GOOGLE_WEBHOOK_KEY || "diintech_google_webhook_secret_2026";

    try {
      const resName = await GoogleAdsService.addLeadFormAssetToCampaign(
        creds,
        campaign.googleCampaignId,
        campaign.businessName || campaign.name,
        campaign.googleLeadFormTitle || "Get Leads",
        campaign.googleLeadFormDescription || "Fill form",
        webhookUrl,
        webhookKey
      );
      console.log("Resulting asset resource name:", resName);
    } catch (apiErr) {
      console.error("INNER API ERROR:", JSON.stringify(apiErr.response?.data, null, 2));
    }

  } catch (err) {
    console.error("Test script failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
run();
