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

  parseGridTask: async (userPrompt) => {
    const systemPrompt = `You are an AI that parses natural language lead generation tasks into a strict JSON format. 
Extract the business category, city, state (if applicable), and platforms to scrape.
CRITICAL: If the user provides a PIN code or a range of PIN codes (e.g., "110001 to 110010" or "110001, 110005"), you MUST expand them into a complete array of all individual PIN codes in that range.

Return ONLY valid JSON:
{
  "category": "e.g., Medical Store",
  "city": "e.g., Delhi",
  "state": "e.g., Delhi",
  "pincodes": ["110001", "110002", "110003"], // The expanded array of strings
  "platforms": ["googleMaps", "justdial"] // Infer from prompt or default to all if unspecified
}`;
    const result = await aiProvider.complete(userPrompt, { systemPrompt, maxTokens: 800 });
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

  analyzePerformance: async (input) => {
    const systemPrompt = `You are an expert digital marketing AI analyst. 
Given the following campaign metrics (spend, impressions, clicks, ctr, cpc, budget, objective, status), analyze the health of the campaign.
Provide highly specific, actionable, and metric-based recommendations with exact suggested values (e.g., recommend increasing the budget to a specific minimum amount like ₹500 based on the current budget, or suggesting precise targeting/location changes). Do NOT give generic or vague advice.
Return ONLY valid JSON in the exact following format:
{
  "healthScore": 85,
  "analysis": "A short 1-2 sentence overall analysis.",
  "recommendations": [
    "A specific, actionable recommendation to improve CTR or CPC with exact numbers.",
    "Another recommendation about budget or targeting with exact numbers and values.",
    "A third recommendation."
  ]
}`;
    const userPrompt = `Campaign Metrics:\n${JSON.stringify(input, null, 2)}`;
    const result = await aiProvider.complete(userPrompt, { systemPrompt, maxTokens: 800 });
    return parseJSON(result);
  },

  analyzeCampaignSetup: async (input) => {
    const systemPrompt = `You are an expert digital marketing AI.
Analyze the following ad campaign setup data in real-time.
Provide a health score (0-100), a checklist of 4-5 items (whether they passed or failed based on best practices), 2-3 short actionable suggestions, and an 'optimizations' object containing the recommended budget and radius.
Return ONLY valid JSON in this exact format:
{
  "score": 85,
  "checklist": [
    { "text": "Content optimized for target audiences", "passed": true },
    { "text": "High visual aesthetics checked", "passed": false }
  ],
  "suggestions": [
    "Increase budget to ₹1500 for better reach.",
    "Add more specific interests to narrow down the audience."
  ],
  "optimizations": {
    "budget": "1500",
    "radius": 15
  }
}`;
    const userPrompt = `Campaign Setup Data:\n${JSON.stringify(input, null, 2)}`;
    const result = await aiProvider.complete(userPrompt, { systemPrompt, maxTokens: 800 });
    return parseJSON(result);
  },
};

export default AIService;
