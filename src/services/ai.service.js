import aiProvider from "./ai/aiProvider.js";
import { prompts } from "../prompts/ai.prompts.js";
import AppError from "../utils/AppError.js";
import { scrapeUrlText } from "../utils/url.scraper.js";
import ImageService from "./image.service.js";

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

  generateMagicCampaign: async (input, userId) => {
    // 1. Scrape URL
    const urlText = await scrapeUrlText(input.url);
    if (!urlText && !input.description) {
      throw new AppError("Could not read the website and no description was provided. Please provide a description.", 400);
    }
    
    // 2. Call AI
    const { systemPrompt, prompt } = prompts.magicCampaign({
      urlText,
      description: input.description || "None",
      budget: input.budget || 500,
      platform: input.platform || "both",
      googleAdType: input.googleAdType || "search"
    });
    
    const result = await aiProvider.complete(prompt, { systemPrompt, maxTokens: 3500 });
    const parsedData = parseJSON(result);

    // 3. Generate Image optionally
    if (input.generateImage && parsedData.suggestedImagePrompt) {
      try {
        const imageRes = await ImageService.generate({ 
          prompt: parsedData.suggestedImagePrompt, 
          userId 
        });
        parsedData.imageUrl = imageRes.url;
      } catch (err) {
        console.error("Magic Image Gen failed:", err.message);
      }
    }

    return parsedData;
  },
};

export default AIService;
