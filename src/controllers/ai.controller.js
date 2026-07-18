import AIService from "../services/ai.service.js";
import ImageService from "../services/image.service.js";
import { successResponse } from "../utils/apiResponse.js";

const handler = (fn) => async (req, res, next) => {
  try {
    const result = await fn(req.body, req.user);
    successResponse(res, result);
  } catch (err) { next(err); }
};

export const generateAdCopy = handler((body) => AIService.generateAdCopy(body));
export const generateEmail = handler((body) => AIService.generateEmail(body));
export const translateAdCopy = handler((body) => AIService.translateAdCopy(body));
export const generateStrategy = handler((body) => AIService.generateMarketingStrategy(body));
export const generateSEOTitle = handler((body) => AIService.generateSEOTitle(body));
export const generateSEODescription = handler((body) => AIService.generateSEODescription(body));
export const generateKeywords = handler((body) => AIService.generateKeywords(body));
export const generateHashtags = handler((body) => AIService.generateHashtags(body));
export const generateCaptions = handler((body) => AIService.generateCaptions(body));
export const generateCTA = handler((body) => AIService.generateCTA(body));
export const generateCampaignSuggestion = handler((body) => AIService.generateCampaignSuggestion(body));

export const generateImage = async (req, res, next) => {
  try {
    const result = await ImageService.generate({ ...req.body, userId: req.user._id });
    successResponse(res, result, "Image generated");
  } catch (err) { next(err); }
};
