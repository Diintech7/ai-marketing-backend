import OpenRouterProvider from "./OpenRouterProvider.js";

const providers = {
  openrouter: OpenRouterProvider,
  // gemini: GeminiProvider,   // plug in later
  // openai: OpenAIProvider,   // plug in later
};

const AI_PROVIDER = process.env.AI_PROVIDER || "openrouter";

const provider = new (providers[AI_PROVIDER] || OpenRouterProvider)();

export default provider;
