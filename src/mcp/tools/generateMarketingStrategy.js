import AIService from "../../services/ai.service.js";

export const generateMarketingStrategyTool = {
  name: "generateMarketingStrategy",
  description: "Generate a full AI-powered marketing strategy for a product or business",
  inputSchema: {
    type: "object",
    properties: {
      productName: { type: "string", description: "Product or business name" },
      description: { type: "string", description: "Product/business description" },
      targetAudience: { type: "string", description: "Target audience" },
      budget: { type: "number", description: "Monthly marketing budget in INR" },
      goals: { type: "string", description: "Marketing goals e.g. brand awareness, lead generation" },
    },
    required: ["productName", "description"],
  },
  handler: async (input) => {
    return AIService.generateMarketingStrategy(input);
  },
};
