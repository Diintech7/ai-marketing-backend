import CampaignService from "../../services/campaign.service.js";

export const createCampaignTool = {
  name: "createCampaign",
  description: "Create a new marketing campaign (saved as draft in DB)",
  inputSchema: {
    type: "object",
    properties: {
      userId: { type: "string", description: "User ID" },
      userPlan: { type: "string", description: "User subscription plan", default: "free" },
      name: { type: "string", description: "Campaign name" },
      objective: { type: "string", description: "Campaign objective e.g. TRAFFIC, CONVERSIONS" },
      budget: { type: "number", description: "Daily budget in paise (INR)" },
      startDate: { type: "string", description: "Start date ISO string" },
      endDate: { type: "string", description: "End date ISO string" },
    },
    required: ["userId", "name", "objective", "budget"],
  },
  handler: async ({ userId, userPlan = "free", ...body }) => {
    const campaign = await CampaignService.create(userId, userPlan, body);
    return { campaignId: campaign._id, name: campaign.name, status: campaign.status };
  },
};
