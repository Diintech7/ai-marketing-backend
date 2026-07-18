import CampaignService from "../../services/campaign.service.js";

export const campaignAnalyticsTool = {
  name: "campaignAnalytics",
  description: "Fetch and sync latest Meta insights for a campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID from DB" },
      user: {
        type: "object",
        properties: {
          _id: { type: "string" },
          metaAccessToken: { type: "string" },
          metaAdAccountId: { type: "string" },
        },
        required: ["_id", "metaAccessToken", "metaAdAccountId"],
      },
    },
    required: ["campaignId", "user"],
  },
  handler: async ({ campaignId, user }) => {
    const campaign = await CampaignService.syncInsights(user, campaignId);
    return { campaignId: campaign._id, insights: campaign.insights };
  },
};
