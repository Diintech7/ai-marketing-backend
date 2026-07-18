import AIService from "../../services/ai.service.js";

export const keywordGeneratorTool = {
  name: "keywordGenerator",
  description: "Generate relevant keywords for a product or campaign",
  inputSchema: {
    type: "object",
    properties: {
      productName: { type: "string", description: "Product or service name" },
      description: { type: "string", description: "Brief description" },
      industry: { type: "string", description: "Industry or niche" },
    },
    required: ["productName", "description"],
  },
  handler: async (input) => {
    return AIService.generateKeywords(input);
  },
};
