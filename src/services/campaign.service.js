import campaignRepo from "../repositories/campaign.repository.js";
import MetaService from "./meta.service.js";
import GoogleAdsService from "./google.service.js";
import AppError from "../utils/AppError.js";
import { PLAN_LIMITS } from "../constants/index.js";
import WebhookService from "./webhook.service.js";

const getMetaCreds = (user) => {
  if (user.adMode === "PLATFORM") {
    if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID)
      throw new AppError("Platform Meta credentials are not configured", 500);
    return { accessToken: process.env.META_ACCESS_TOKEN, adAccountId: process.env.META_AD_ACCOUNT_ID };
  }
  const accessToken = user.metaAccessToken;
  const adAccountId = user.metaAdAccountId;
  if (!accessToken || !adAccountId)
    throw new AppError("Please connect your Meta account in Settings first", 400);
  return { accessToken, adAccountId };
};

const getGoogleCreds = (user) => {
  if (user.adMode === "PLATFORM") {
    if (!process.env.GOOGLE_CUSTOMER_ID || !process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_DEVELOPER_TOKEN)
      throw new AppError("Platform Google credentials are not configured", 500);
    return { customerId: process.env.GOOGLE_CUSTOMER_ID, refreshToken: process.env.GOOGLE_REFRESH_TOKEN, developerToken: process.env.GOOGLE_DEVELOPER_TOKEN };
  }
  const customerId     = user.googleAdsCustomerId;
  const refreshToken   = user.googleAdsRefreshToken;
  const developerToken = user.googleAdsDeveloperToken;
  if (!customerId || !refreshToken || !developerToken)
    throw new AppError("Please connect your Google Ads account in Settings first", 400);
  return { customerId, refreshToken, developerToken };
};

const CampaignService = {
  // ─── Create (DB only — draft) ───────────────────────────────
  create: async (userId, userPlan, body) => {
    const count = await campaignRepo.countByUser(userId);
    const limit = PLAN_LIMITS[userPlan]?.campaigns || 2;
    if (count >= limit)
      throw new AppError(`Your ${userPlan} plan allows max ${limit} campaigns. Please upgrade.`, 403);
    return campaignRepo.create({ user: userId, ...body });
  },

  // ─── Get all ────────────────────────────────────────────────
  getAll: (userId, query = {}) => {
    const filter = { user: userId, status: { $ne: "deleted" } };
    if (query.status) filter.status = query.status;
    return campaignRepo.find(filter, { limit: Number(query.limit) || 20, skip: Number(query.skip) || 0 });
  },

  // ─── Get one ────────────────────────────────────────────────
  getOne: async (userId, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(userId, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    return campaign;
  },

  // ─── Update ─────────────────────────────────────────────────
  update: async (userId, campaignId, body) => {
    const campaign = await campaignRepo.findByUserAndId(userId, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.status === "active")
      throw new AppError("Pause the campaign before editing", 400);
    return campaignRepo.updateById(campaignId, body);
  },

  // ─── Publish ────────────────────────────────────────────────
  publish: async (user, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);

    // Wallet Check for PLATFORM mode
    if (user.adMode === "PLATFORM") {
      if (user.walletBalance < campaign.budget) {
        throw new AppError("Insufficient wallet balance to run this campaign. Please recharge.", 402);
      }
      // Deduct 1 day budget as initial charge
      user.walletBalance -= campaign.budget;
      if (typeof user.save === "function") {
        await user.save();
      } else {
        const User = (await import("../models/User.js")).default;
        await User.updateOne({ _id: user._id }, { $inc: { walletBalance: -campaign.budget } });
      }
    }

    // ── Pre-flight Validation ──
    const missing = [];
    const obj = campaign.objective || "TRAFFIC";
    if (campaign.platform === "meta" || campaign.platform === "both") {
      if (obj === "CONVERSIONS" || obj === "SALES" || obj === "APP_PROMOTION") {
        if (!campaign.pixelId) missing.push("Conversions/Sales objective requires a Facebook Pixel ID.");
      }
    }
    
    if (missing.length > 0) {
      campaign.missingRequirements = missing;
      campaign.status = "draft";
      campaign.publishError = "Pre-flight validation failed. See missing requirements.";
      await campaign.save();
      throw new AppError("Campaign has missing requirements. Check the dashboard for details.", 400);
    } else {
      campaign.missingRequirements = [];
    }

    const updates = { status: "active", runMode: user.adMode || "PERSONAL", missingRequirements: [] };
    const platform = campaign.platform || "meta";

    // ── Meta ──
    if (platform === "meta" || platform === "both") {
      try {
        const { accessToken, adAccountId } = getMetaCreds(user);
        if (!campaign.metaCampaignId) {
          const mc = await MetaService.createCampaign(accessToken, adAccountId, campaign);
          campaign.metaCampaignId = mc.id;
          updates.metaCampaignId = mc.id;
          await campaign.save(); // Incremental save
        }

        if (!campaign.adSets || campaign.adSets.length === 0) {
          campaign.adSets.push({
            name: campaign.name + " - Ad Set",
            budget: campaign.budget,
            budgetType: campaign.budgetType,
          });
        }

        for (const adSet of campaign.adSets) {
          if (!adSet.metaAdSetId) {
            const ms = await MetaService.createAdSet(accessToken, adAccountId, {
              ...adSet.toObject(),
              metaCampaignId: updates.metaCampaignId || campaign.metaCampaignId,
              startDate: campaign.startDate,
              endDate:   campaign.endDate,
              objective: campaign.objective,
              pixelId:   campaign.pixelId,
              pageId:    process.env.META_PAGE_ID,
            });
            adSet.metaAdSetId = ms.id;
            await campaign.save(); // Incremental save
          }
        }
        
        // Create Ads and link to the first ad set
        const targetAdSetId = campaign.adSets[0]?.metaAdSetId || updates.adSets?.[0]?.metaAdSetId;
        if (targetAdSetId && campaign.ads && campaign.ads.length > 0) {
          for (const ad of campaign.ads) {
            if (ad.metaAdId) continue; // Skip if already created

            let mediaList = [];
            let videoId = null;
            let finalThumbnailUrl = ad.thumbnailUrl;
            
            if (ad.imageUrls && ad.imageUrls.length > 1) {
              // Carousel / Mixed Media
              for (const url of ad.imageUrls) {
                try {
                  const isVideo = url.match(/\.(mp4|mov|webm)$/i) || url.includes("/video/upload/");
                  if (isVideo) {
                    const vid = await MetaService.uploadVideo(accessToken, adAccountId, url);
                    let thumbHash = null;
                    try {
                      let thumbUrl = (ad.carouselThumbnails && ad.carouselThumbnails.get(url)) || ad.thumbnailUrl;
                      if (!thumbUrl) {
                        thumbUrl = url.replace('.mp4', '.jpg').replace('/video/upload/', '/image/upload/');
                      }
                      thumbHash = await MetaService.uploadImage(accessToken, adAccountId, thumbUrl);
                    } catch (e) {
                      console.warn("Failed to upload auto-generated thumbnail for carousel video", e.message);
                    }
                    if (vid) mediaList.push({ type: 'video', id: vid, thumbHash });
                  } else {
                    const hash = await MetaService.uploadImage(accessToken, adAccountId, url);
                    if (hash) mediaList.push({ type: 'image', id: hash });
                  }
                } catch (err) {
                  console.warn("[Meta Fallback] Mixed media carousel upload failed", err.message);
                }
              }
            } else if (ad.imageUrl) {
              // Single Image or Video
              const isVideo = ad.imageUrl.match(/\.(mp4|mov|webm)$/i) || ad.imageUrl.includes("/video/upload/");
              
              if (isVideo && !finalThumbnailUrl) {
                // Smart Cloudinary Fallback to auto-generate thumbnail from the first frame
                finalThumbnailUrl = ad.imageUrl.replace('.mp4', '.jpg').replace('/video/upload/', '/image/upload/');
              }
              try {
                if (isVideo) {
                  videoId = await MetaService.uploadVideo(accessToken, adAccountId, ad.imageUrl);
                  if (!videoId) throw new Error("Meta API did not return a Video ID");
                } else {
                  const hash = await MetaService.uploadImage(accessToken, adAccountId, ad.imageUrl);
                  if (hash) mediaList.push({ type: 'image', id: hash });
                }
              } catch (err) {
                console.warn("[Meta Fallback] Media upload failed", err.message);
                if (isVideo) throw new Error(`Video upload to Meta failed: ${err.message}`);
              }
            }

            const creative = await MetaService.createAdCreative(accessToken, adAccountId, {
              name: ad.name || campaign.name,
              pageId: process.env.META_PAGE_ID,
              adCopy: ad.metaAdCopy || ad.adCopy,
              mediaList,
              videoId,
              imageUrl: ad.imageUrl,
              thumbnailUrl: finalThumbnailUrl,
              link: ad.link || campaign.link || "https://www.example.com"
            });

            const metaAd = await MetaService.createAd(accessToken, adAccountId, {
              name: ad.name || campaign.name,
              metaAdSetId: targetAdSetId,
              creativeId: creative.id
            });

            ad.metaAdId = metaAd.id;
            await campaign.save(); // Incremental save
          }
          updates.ads = campaign.ads;
        }

        await MetaService.publishCampaign(accessToken, updates.metaCampaignId || campaign.metaCampaignId);
        updates.adSets = campaign.adSets;
        updates.publishError = null; // Clear error on success
      } catch (err) {
        campaign.publishError = err.message || "Failed to publish to Meta";
        await campaign.save();
        throw err;
      }
    }

    // ── Google ──
    if (platform === "google" || platform === "both") {
      const creds = getGoogleCreds(user);
      if (!campaign.googleCampaignId) {
        const gcId = await GoogleAdsService.createCampaign(creds, campaign);
        updates.googleCampaignId = gcId;
        
        // Add Campaign Criteria (Location, Language, & Ad Schedules)
        let loc = null;
        if (campaign.adSets && campaign.adSets.length > 0 && campaign.adSets[0].targeting?.locations?.length > 0) {
          loc = campaign.adSets[0].targeting.locations[0];
        }
        await GoogleAdsService.setCampaignCriteria(creds, gcId, loc, campaign);

        // Link Call Asset if CTA is phone call
        if (campaign.link && campaign.link.startsWith("tel:")) {
          await GoogleAdsService.addCallAssetToCampaign(creds, gcId, campaign.link);
        }

        // Link Lead Form Asset if Objective is LEADS
        if (campaign.objective === "LEADS") {
          const serverUrl = process.env.SERVER_URL || "https://ai-marketing-backend-nmoc.onrender.com";
          const webhookUrl = `${serverUrl}/api/webhooks/google`;
          const webhookKey = process.env.GOOGLE_WEBHOOK_KEY || "diintech_google_webhook_secret_2026";
          
          await GoogleAdsService.addLeadFormAssetToCampaign(
            creds,
            gcId,
            campaign.businessName || campaign.name,
            campaign.googleLeadFormTitle || "Get Leads",
            campaign.googleLeadFormDescription || "Fill the form below to receive more details.",
            webhookUrl,
            webhookKey
          );
        }

        if (campaign.googleAdType === "pmax") {
          const ad = campaign.ads[0];
          const finalUrl = ad.link || campaign.link || "https://www.example.com";
          const agId = await GoogleAdsService.createPmaxAssetGroup(
            creds,
            gcId,
            campaign,
            ad.googleAdCopy || ad.adCopy,
            ad.imageUrls || [ad.imageUrl],
            campaign.logoUrl || null,
            campaign.businessName,
            finalUrl
          );
          updates.googleAdGroupId = agId;
        } else {
          const agId = await GoogleAdsService.createAdGroup(creds, gcId, campaign);
          updates.googleAdGroupId = agId;
          
          if (campaign.aiContent && campaign.aiContent.keywords) {
            await GoogleAdsService.addKeywordsToAdGroup(creds, agId, campaign.aiContent.keywords);
          }

          for (const ad of campaign.ads) {
            const finalUrl = ad.link || campaign.link || "https://www.example.com";
            await GoogleAdsService.createAd(creds, agId, ad.googleAdCopy || ad.adCopy, campaign.googleAdType, finalUrl, ad.imageUrl, campaign.businessName, ad.videoUrl || campaign.videoUrl, ad.imageUrls || []);
          }
        }
      } else {
        await GoogleAdsService.enableCampaign(creds, campaign.googleCampaignId);
      }
    }

    const updatedCampaign = await campaignRepo.updateById(campaignId, updates);

    // Fire webhook notification (non-blocking)
    WebhookService.send(user, updatedCampaign || campaign, "campaign.status_changed", "active").catch(() => {});

    return updatedCampaign;
  },

  // ─── Pause ──────────────────────────────────────────────────
  pause: async (user, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    const platform = campaign.platform || "meta";

    if ((platform === "meta" || platform === "both") && campaign.metaCampaignId) {
      const { accessToken } = getMetaCreds(user);
      await MetaService.pauseCampaign(accessToken, campaign.metaCampaignId);
    }
    if ((platform === "google" || platform === "both") && campaign.googleCampaignId) {
      const creds = getGoogleCreds(user);
      await GoogleAdsService.pauseCampaign(creds, campaign.googleCampaignId);
    }
    const paused = await campaignRepo.updateById(campaignId, { status: "paused" });
    WebhookService.send(user, paused || campaign, "campaign.status_changed", "paused").catch(() => {});
    return paused;
  },

  // ─── Resume ─────────────────────────────────────────────────
  resume: async (user, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    const platform = campaign.platform || "meta";

    if ((platform === "meta" || platform === "both") && campaign.metaCampaignId) {
      const { accessToken } = getMetaCreds(user);
      await MetaService.publishCampaign(accessToken, campaign.metaCampaignId);
    }
    if ((platform === "google" || platform === "both") && campaign.googleCampaignId) {
      const creds = getGoogleCreds(user);
      await GoogleAdsService.enableCampaign(creds, campaign.googleCampaignId);
    }
    return campaignRepo.updateById(campaignId, { status: "active" });
  },

  // ─── Update Budget ──────────────────────────────────────────
  updateBudget: async (user, campaignId, budget) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    const platform = campaign.platform || "meta";

    if ((platform === "meta" || platform === "both") && campaign.metaCampaignId) {
      const { accessToken } = getMetaCreds(user);
      await MetaService.updateCampaign(accessToken, campaign.metaCampaignId, { daily_budget: budget });
    }
    // Google budget update handled separately via budget resource
    return campaignRepo.updateById(campaignId, { budget });
  },

  // ─── Sync Insights ──────────────────────────────────────────
  syncInsights: async (user, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    const platform = campaign.platform || "meta";

    let insights = { impressions: 0, clicks: 0, spend: 0, reach: 0, ctr: 0, cpc: 0 };

    if ((platform === "meta" || platform === "both") && campaign.metaCampaignId) {
      const { accessToken } = getMetaCreds(user);
      const raw = await MetaService.getCampaignInsights(accessToken, campaign.metaCampaignId);
      insights = {
        impressions: Number(raw.impressions) || 0,
        clicks:      Number(raw.clicks)      || 0,
        spend:       Number(raw.spend)        || 0,
        reach:       Number(raw.reach)        || 0,
        ctr:         Number(raw.ctr)          || 0,
        cpc:         Number(raw.cpc)          || 0,
      };
    }

    if ((platform === "google" || platform === "both") && campaign.googleCampaignId) {
      const creds = getGoogleCreds(user);
      const raw = await GoogleAdsService.getInsights(creds, campaign.googleCampaignId);
      // Merge: add google on top of meta if "both"
      insights.impressions += raw.impressions;
      insights.clicks      += raw.clicks;
      insights.spend       += raw.spend;
      insights.ctr          = insights.clicks ? (insights.clicks / insights.impressions) * 100 : 0;
      insights.cpc          = insights.clicks ? insights.spend / insights.clicks : 0;
    }

    return campaignRepo.updateById(campaignId, { insights });
  },

  // ─── Delete ─────────────────────────────────────────────────
  delete: async (user, campaignId) => {
    const campaign = await campaignRepo.findByUserAndId(user._id, campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    const platform = campaign.platform || "meta";

    if ((platform === "meta" || platform === "both") && campaign.metaCampaignId) {
      try {
        const { accessToken } = getMetaCreds(user);
        await MetaService.deleteCampaign(accessToken, campaign.metaCampaignId);
      } catch { /* ignore if already deleted on Meta */ }
    }
    if ((platform === "google" || platform === "both") && campaign.googleCampaignId) {
      try {
        const creds = getGoogleCreds(user);
        await GoogleAdsService.removeCampaign(creds, campaign.googleCampaignId);
      } catch (err) {
        console.error("[GoogleAds Delete Error] Failed to remove campaign from Google Ads:", err.message);
      }
    }
    return campaignRepo.updateById(campaignId, { status: "deleted" });
  },
};

export default CampaignService;
