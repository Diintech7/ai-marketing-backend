import CampaignService from "../../services/campaign.service.js";

export const pauseCampaignTool = {
  name: "pauseCampaign",
  description: "Pause an active Meta campaign",
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
    const campaign = await CampaignService.pause(user, campaignId);
    return { campaignId: campaign._id, status: campaign.status };
  },
};
