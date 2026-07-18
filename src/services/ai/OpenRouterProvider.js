import axios from "axios";
import BaseAIProvider from "./BaseAIProvider.js";
import AppError from "../../utils/AppError.js";

class OpenRouterProvider extends BaseAIProvider {
  constructor() {
    super();
    this.client = axios.create({
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      timeout: 30000,
    });
    this.model = process.env.AI_MODEL || "deepseek/deepseek-chat";
  }

  async complete(prompt, options = {}) {
    this.client.defaults.headers.common["Authorization"] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    this.client.defaults.headers.common["Content-Type"] = "application/json";
    this.client.defaults.headers.common["HTTP-Referer"] = process.env.CLIENT_URL || "http://localhost:3000";
    try {
      const { data } = await this.client.post("/chat/completions", {
        model: options.model || this.model,
        messages: [
          ...(options.systemPrompt
            ? [{ role: "system", content: options.systemPrompt }]
            : []),
          { role: "user", content: prompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
      });
      return data.choices[0].message.content.trim();
    } catch (err) {
      const msg = err.response?.data?.error?.message || "AI request failed";
      throw new AppError(msg, 500);
    }
  }
}

export default OpenRouterProvider;
