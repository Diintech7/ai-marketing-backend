import AIService from "../../services/ai.service.js";

export const seoGeneratorTool = {
  name: "seoGenerator",
  description: "Generate SEO-optimized title and description for a product or page",
  inputSchema: {
    type: "object",
    properties: {
      productName: { type: "string", description: "Product or page name" },
      description: { type: "string", description: "Brief description" },
      keywords: { type: "array", items: { type: "string" }, description: "Target keywords" },
    },
    required: ["productName", "description"],
  },
  handler: async (input) => {
    const [title, description] = await Promise.all([
      AIService.generateSEOTitle(input),
      AIService.generateSEODescription(input),
    ]);
    return { title, description };
  },
};
