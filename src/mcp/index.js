import dotenv from "dotenv";
dotenv.config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import connectDB from "../config/db.js";
import createMCPServer from "./server.js";

const start = async () => {
  await connectDB();

  const server = createMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("✅ MCP Server running via stdio");
};

start().catch((err) => {
  console.error("❌ MCP Server failed to start:", err.message);
  process.exit(1);
});
