import aiProvider from "./ai/aiProvider.js";
import { prompts } from "../prompts/ai.prompts.js";
import AppError from "../utils/AppError.js";

const parseJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (error) {
    console.error("parseJSON error:", error);
    console.error("AI Response was:", text);
    throw new AppError("AI returned invalid response. Please try again.", 500);
  }
};

const AIService = {
  generateEmail: async (input) => {
    const { systemPrompt, prompt } = prompts.generateEmail(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },
  generateAdCopy: async (input) => {
    const { systemPrompt, prompt } = prompts.adCopy(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  translateAdCopy: async (input) => {
    const { systemPrompt, prompt } = prompts.translateAdCopy(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateMarketingStrategy: async (input) => {
    const { systemPrompt, prompt } = prompts.marketingStrategy(input);
    const result = await aiProvider.complete(prompt, { systemPrompt, maxTokens: 2000 });
    return parseJSON(result);
  },

  generateSEOTitle: async (input) => {
    const { systemPrompt, prompt } = prompts.seoTitle(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateSEODescription: async (input) => {
    const { systemPrompt, prompt } = prompts.seoDescription(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateKeywords: async (input) => {
    const { systemPrompt, prompt } = prompts.keywords(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateHashtags: async (input) => {
    const { systemPrompt, prompt } = prompts.hashtags(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateCaptions: async (input) => {
    const { systemPrompt, prompt } = prompts.captions(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateCTA: async (input) => {
    const { systemPrompt, prompt } = prompts.cta(input);
    const result = await aiProvider.complete(prompt, { systemPrompt });
    return parseJSON(result);
  },

  generateCampaignSuggestion: async (input) => {
    const { systemPrompt, prompt } = prompts.campaignSuggestion(input);
    const result = await aiProvider.complete(prompt, { systemPrompt, maxTokens: 2000 });
    return parseJSON(result);
  },
};

export default AIService;
