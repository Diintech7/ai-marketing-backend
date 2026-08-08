import CampaignService from "../services/campaign.service.js";
import AppError from "../utils/AppError.js";
import { successResponse } from "../utils/apiResponse.js";
import AIService from "../services/ai.service.js";

export const launchCampaign = async (req, res, next) => {
  try {
    const user = req.user;
    
    // UI mapping
    const { 
      contentUrl, platform, geography, demography, 
      category, cta, budget, durationDays, destinationUrl 
    } = req.body;

    if (!budget || !platform || !destinationUrl) {
      throw new AppError("Missing required fields: budget, platform, destinationUrl", 400);
    }

    // Since this is Headless API, we auto-generate the campaign
    // We assume the user has PLATFORM adMode logic set
    if (user.adMode !== "PLATFORM") {
      throw new AppError("Your account is not configured for API usage (Platform Mode required).", 403);
    }

    // 1. Generate Ad Content using AI based on destinationUrl (or category)
    const aiData = await AIService.generateMagicCampaign({
      url: destinationUrl,
      description: category || "Business",
      budget: budget,
      platform: platform === "facebook" || platform === "instagram" ? "meta" : "google",
      googleAdType: "search", // Default for now
      generateImage: !contentUrl // If no content provided, generate an image
    }, user._id);

    // 2. Draft the Campaign structure
    const campaignPayload = {
      name: aiData.campaign.name,
      objective: aiData.campaign.objective || "TRAFFIC",
      platform: platform === "facebook" || platform === "instagram" ? "meta" : "google",
      googleAdType: "search",
      budget: Number(budget),
      budgetType: "daily",
      aiGenerated: true,
      startDate: new Date(),
      endDate: durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null,
      aiContent: {
        hashtags: aiData.content?.hashtags || [],
        captions: aiData.content?.captions || [],
        seoTitle: aiData.content?.seoTitle || [],
        keywords: aiData.content?.keywords || [],
      },
      ads: aiData.ads.slice(0, 1).map(ad => ({
        name: `${aiData.campaign.name} - API Ad`,
        metaAdCopy: ad.metaAdCopy,
        googleAdCopy: ad.googleAdCopy,
        imageUrl: contentUrl || aiData.imageUrl || null,
        link: destinationUrl,
      })),
      link: destinationUrl,
      source: "EXTERNAL_API",
      runMode: "PLATFORM"
    };

    // 3. Create Campaign in DB
    const campaign = await CampaignService.create(user._id, user.plan, campaignPayload);

    // 4. Publish Campaign (Deducts wallet and launches to Meta/Google)
    const activeCampaign = await CampaignService.publish(user, campaign._id);

    successResponse(res, { campaignId: activeCampaign._id }, "Ad campaign launched successfully via API");
  } catch (err) {
    next(err);
  }
};
