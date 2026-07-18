import CampaignService from "../../services/campaign.service.js";

export const publishCampaignTool = {
  name: "publishCampaign",
  description: "Publish a draft campaign to Meta Ads",
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID from DB" },
      user: {
        type: "object",
        description: "User object with metaAccessToken and metaAdAccountId",
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
    const campaign = await CampaignService.publish(user, campaignId);
    return { campaignId: campaign._id, status: campaign.status, metaCampaignId: campaign.metaCampaignId };
  },
};
