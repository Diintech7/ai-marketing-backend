import AIService from "../../services/ai.service.js";

export const generateAdCopyTool = {
  name: "generateAdCopy",
  description: "Generate AI-powered ad copy including headline, description, CTA, and primary text",
  inputSchema: {
    type: "object",
    properties: {
      productName: { type: "string", description: "Product or service name" },
      description: { type: "string", description: "Brief product/service description" },
      targetAudience: { type: "string", description: "Target audience description" },
      tone: { type: "string", description: "Tone: professional, casual, urgent, friendly", default: "professional" },
      platform: { type: "string", description: "Platform: facebook, instagram", default: "facebook" },
    },
    required: ["productName", "description"],
  },
  handler: async (input) => {
    return AIService.generateAdCopy(input);
  },
};
