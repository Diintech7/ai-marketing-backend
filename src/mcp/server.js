import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createCampaignTool } from "./tools/createCampaign.js";
import { publishCampaignTool } from "./tools/publishCampaign.js";
import { pauseCampaignTool } from "./tools/pauseCampaign.js";
import { resumeCampaignTool } from "./tools/resumeCampaign.js";
import { generateAdCopyTool } from "./tools/generateAdCopy.js";
import { generateImageTool } from "./tools/generateImage.js";
import { campaignAnalyticsTool } from "./tools/campaignAnalytics.js";
import { seoGeneratorTool } from "./tools/seoGenerator.js";
import { keywordGeneratorTool } from "./tools/keywordGenerator.js";
import { generateMarketingStrategyTool } from "./tools/generateMarketingStrategy.js";

const ALL_TOOLS = [
  createCampaignTool,
  publishCampaignTool,
  pauseCampaignTool,
  resumeCampaignTool,
  generateAdCopyTool,
  generateImageTool,
  campaignAnalyticsTool,
  seoGeneratorTool,
  keywordGeneratorTool,
  generateMarketingStrategyTool,
];

// Convert JSON Schema properties to Zod shape for MCP SDK
const buildZodShape = (properties = {}, required = []) => {
  const shape = {};
  for (const [key, def] of Object.entries(properties)) {
    let schema;
    if (def.type === "string") schema = z.string();
    else if (def.type === "number") schema = z.number();
    else if (def.type === "boolean") schema = z.boolean();
    else if (def.type === "array") schema = z.array(z.any());
    else schema = z.any(); // object or unknown

    if (def.description) schema = schema.describe(def.description);
    if (!required.includes(key)) schema = schema.optional();
    shape[key] = schema;
  }
  return shape;
};

const createMCPServer = () => {
  const server = new McpServer({
    name: "ai-marketing-mcp",
    version: "1.0.0",
  });

  for (const tool of ALL_TOOLS) {
    const { properties = {}, required = [] } = tool.inputSchema;
    const zodShape = buildZodShape(properties, required);

    server.tool(tool.name, tool.description, zodShape, async (args) => {
      try {
        const result = await tool.handler(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    });
  }

  return server;
};

export default createMCPServer;
