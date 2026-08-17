import { v4 as uuidv4 } from "uuid";
import CampaignService from "../services/campaign.service.js";
import AIService from "../services/ai.service.js";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { successResponse } from "../utils/apiResponse.js";
import Campaign from "../models/Campaign.js";

// ─────────────────────────────────────────────────────────────
// Helper: log an activity
// ─────────────────────────────────────────────────────────────
const log = (userId, eventType, status, data = {}) =>
  ActivityLog.create({ userId, eventType, status, ...data }).catch(() => {});

// ─────────────────────────────────────────────────────────────
// 1. LAUNCH CAMPAIGN  (existing — enhanced)
// ─────────────────────────────────────────────────────────────
export const launchCampaign = async (req, res, next) => {
  try {
    const user = req.user;

    const {
      contentUrl, platform, geography, demography,
      category, cta, budget, durationDays, destinationUrl,
      // Advanced fields
      googleAdType, objective, businessName, imageUrls,
      videoUrl, youtubeUrl, carouselThumbnails, leadFormDetails, pixelId, placements
    } = req.body;

    // Validation
    if (!budget || !platform || !destinationUrl) {
      throw new AppError(
        "Missing required fields: budget, platform, destinationUrl",
        400,
        "ERR_MISSING_FIELDS"
      );
    }
    if (platform === "google" && !businessName) {
      throw new AppError("businessName is required for Google ads.", 400, "ERR_MISSING_BUSINESS_NAME");
    }
    if (user.adMode !== "PLATFORM") {
      throw new AppError(
        "Your account is not configured for API usage (Platform Mode required).",
        403,
        "ERR_PLATFORM_MODE_REQUIRED"
      );
    }
    if (user.walletBalance < Number(budget)) {
      throw new AppError(
        "Insufficient wallet balance to launch this campaign.",
        402,
        "ERR_INSUFFICIENT_CREDITS"
      );
    }

    // 1. AI generate
    const aiData = await AIService.generateMagicCampaign({
      url:           destinationUrl,
      description:   category || "Business",
      budget:        budget,
      platform:      platform === "facebook" || platform === "instagram" ? "meta" : platform,
      googleAdType:  googleAdType || "search",
      generateImage: !contentUrl && !(imageUrls && imageUrls.length > 0) && !videoUrl && !youtubeUrl,
    }, user._id);

    // 2. Build campaign payload
    const campaignPayload = {
      name:        aiData.campaign.name,
      objective:   objective || aiData.campaign.objective || "TRAFFIC",
      platform:    platform === "facebook" || platform === "instagram" ? "meta" : platform,
      googleAdType: googleAdType || "search",
      budget:      Number(budget),
      budgetType:  "daily",
      aiGenerated: true,
      startDate:   new Date(),
      endDate:     durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : null,
      aiContent: {
        hashtags: aiData.content?.hashtags || [],
        captions: aiData.content?.captions || [],
        seoTitle: aiData.content?.seoTitle || [],
        keywords: aiData.content?.keywords || [],
      },
      businessName: businessName || null,
      pixelId: pixelId || null,
      leadFormDetails: leadFormDetails || null,
      ads: aiData.ads.slice(0, 1).map(ad => ({
        name:       `${aiData.campaign.name} - API Ad`,
        metaAdCopy: ad.metaAdCopy,
        googleAdCopy: ad.googleAdCopy,
        imageUrl:   contentUrl || aiData.imageUrl || null,
        imageUrls:  imageUrls || [],
        videoUrl:   videoUrl || null,
        youtubeUrl: youtubeUrl || null,
        carouselThumbnails: carouselThumbnails || null,
        link:       destinationUrl,
      })),
      link: destinationUrl,
      adSets: [{
        name: `${aiData.campaign.name} - Ad Set`,
        budget: Number(budget),
        budgetType: "daily",
        targeting: {
          publisher_platforms: placements || null
        }
      }]
    };

    // 3. Create + Publish
    const campaign       = await CampaignService.create(user._id, user.plan, campaignPayload);
    const activeCampaign = await CampaignService.publish(user, campaign._id);

    // 4. Log activity
    await log(user._id, "CAMPAIGN_PUBLISHED", "success", {
      requestId:  req.requestId,
      correlationId: req.correlationId,
      campaignId: activeCampaign._id,
      message:    "Campaign launched via external API",
    });

    successResponse(res, {
      campaignId:    activeCampaign._id,
      campaignName:  activeCampaign.name,
      status:        activeCampaign.status,
      walletBalance: user.walletBalance,
    }, "Ad campaign launched successfully via API");

  } catch (err) {
    // Log error
    if (req.user) {
      await log(req.user._id, "ERROR_OCCURRED", "error", {
        requestId: req.requestId,
        errorCode: err.errorCode || "ERR_UNKNOWN",
        message:   err.message,
      });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET CAMPAIGN STATUS
// ─────────────────────────────────────────────────────────────
export const getCampaignStatus = async (req, res, next) => {
  try {
    const user       = req.user;
    const { id }     = req.params;

    let campaign = await Campaign.findOne({ _id: id, user: user._id });

    if (!campaign) {
      throw new AppError("Campaign not found or access denied.", 404, "ERR_CAMPAIGN_NOT_FOUND");
    }

    // Sync status and insights on-the-fly from Meta/Google
    if (campaign.status !== "draft") {
      try {
        await CampaignService.syncStatus(user, campaign._id);
        await CampaignService.syncInsights(user, campaign._id);
        campaign = await Campaign.findById(campaign._id);
      } catch (syncErr) {
        console.error(`[getCampaignStatus Sync Error] Failed to sync: ${syncErr.message}`);
      }
    }

    successResponse(res, {
      campaignId:   campaign._id,
      campaignName: campaign.name,
      platform:     campaign.platform,
      objective:    campaign.objective,
      status:       campaign.status,
      budget:       campaign.budget,
      startDate:    campaign.startDate,
      endDate:      campaign.endDate,
      platformBreakdown: campaign.insights?.platformBreakdown || null,
      insights: {
        impressions: campaign.insights?.impressions || 0,
        clicks:      campaign.insights?.clicks || 0,
        spend:       campaign.insights?.spend || 0,
        reach:       campaign.insights?.reach || 0,
        ctr:         campaign.insights?.ctr || 0,
        cpc:         campaign.insights?.cpc || 0,
      },
      createdAt:    campaign.createdAt,
      updatedAt:    campaign.updatedAt,
    }, "Campaign status fetched successfully");

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2a. PAUSE CAMPAIGN
// ─────────────────────────────────────────────────────────────
export const pauseCampaign = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, user: user._id });
    if (!campaign) {
      throw new AppError("Campaign not found or access denied.", 404, "ERR_CAMPAIGN_NOT_FOUND");
    }

    if (campaign.status === "paused") {
      throw new AppError("Campaign is already paused.", 400, "ERR_ALREADY_PAUSED");
    }

    await CampaignService.pause(user, id);

    await log(user._id, "CAMPAIGN_PAUSED", "success", {
      requestId: req.requestId,
      campaignId: id,
      message: `Campaign ${id} paused via API`,
    });

    successResponse(res, { campaignId: id, status: "paused" }, "Campaign paused successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2b. RESUME CAMPAIGN
// ─────────────────────────────────────────────────────────────
export const resumeCampaign = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, user: user._id });
    if (!campaign) {
      throw new AppError("Campaign not found or access denied.", 404, "ERR_CAMPAIGN_NOT_FOUND");
    }

    if (campaign.status === "active") {
      throw new AppError("Campaign is already active.", 400, "ERR_ALREADY_ACTIVE");
    }

    await CampaignService.resume(user, id);

    await log(user._id, "CAMPAIGN_PUBLISHED", "success", {
      requestId: req.requestId,
      campaignId: id,
      message: `Campaign ${id} resumed via API`,
    });

    successResponse(res, { campaignId: id, status: "active" }, "Campaign resumed successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 2c. DELETE CAMPAIGN
// ─────────────────────────────────────────────────────────────
export const deleteCampaign = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, user: user._id });
    if (!campaign) {
      throw new AppError("Campaign not found or access denied.", 404, "ERR_CAMPAIGN_NOT_FOUND");
    }

    await CampaignService.remove(user, id);

    await log(user._id, "ERROR_OCCURRED", "success", { // Repurposing log
      requestId: req.requestId,
      campaignId: id,
      message: `Campaign ${id} deleted via API`,
      meta: { event: "CAMPAIGN_DELETED" }
    });

    successResponse(res, { campaignId: id, status: "deleted" }, "Campaign deleted successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 3. SYNC CLIENT (register a client from partner's system)
// ─────────────────────────────────────────────────────────────
export const syncClient = async (req, res, next) => {
  try {
    const partnerUser = req.user; // The partner (Sir)
    const { name, email, phone, businessName, externalClientId } = req.body;

    if (!email && !externalClientId) {
      throw new AppError(
        "Either email or externalClientId is required to sync a client.",
        400,
        "ERR_MISSING_CLIENT_IDENTIFIER"
      );
    }

    // Find or create a lightweight record — store in meta field
    let clientRecord = await User.findOne({ email: email?.toLowerCase() });

    let created = false;
    if (!clientRecord) {
      // Create a placeholder client account
      clientRecord = await User.create({
        name:        name || "API Client",
        email:       email || `api_client_${uuidv4()}@diintech.internal`,
        password:    uuidv4(), // random password — they'll use SSO/API
        company:     businessName || "",
        role:        "client",
        assignedAdmin: partnerUser._id,
        approvalStatus: "pending",
        adMode:      "PLATFORM",
        isActive:    true,
      });
      created = true;
    }

    // Log sync activity
    await log(partnerUser._id, "CLIENT_SYNCED", "success", {
      requestId: req.requestId,
      message:   `Client ${email} synced by partner ${partnerUser.name}`,
      meta:      { clientId: clientRecord._id, created, approvalStatus: clientRecord.approvalStatus },
    });

    res.status(created ? 201 : 200).json({
      success:  true,
      message:  created 
        ? "Client registration request received and is pending approval." 
        : (clientRecord.approvalStatus === "approved" ? "Client synced successfully" : "Client registration is pending approval."),
      data: {
        clientId:         clientRecord._id,
        name:             clientRecord.name,
        email:            clientRecord.email,
        businessName:     clientRecord.company,
        approvalStatus:   clientRecord.approvalStatus,
        whatsappConfigured: false,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 4. ACTIVITY LOGS (with pagination + filtering)
// ─────────────────────────────────────────────────────────────
export const getActivityLogs = async (req, res, next) => {
  try {
    const user = req.user;
    const {
      page      = 1,
      limit     = 20,
      eventType,
      status,
      startDate,
      endDate,
    } = req.query;

    const filter = { userId: user._id };

    if (eventType) filter.eventType = eventType;
    if (status)    filter.status    = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await ActivityLog.countDocuments(filter);
    const logs  = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    successResponse(res, {
      logs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    }, "Activity logs fetched successfully");

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. GENERATE API KEY (Admin generates key for a user)
// ─────────────────────────────────────────────────────────────
export const generateApiKey = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new AppError("User not found.", 404, "ERR_USER_NOT_FOUND");
    }

    const newKey = `diin_${uuidv4().replace(/-/g, "")}`;
    targetUser.apiKeys.push(newKey);
    await targetUser.save();

    await log(targetUser._id, "API_KEY_GENERATED", "success", {
      requestId: req.requestId,
      message:   `API key generated by admin`,
    });

    successResponse(res, { apiKey: newKey, userId: targetUser._id }, "API Key generated successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 6. REVOKE API KEY
// ─────────────────────────────────────────────────────────────
export const revokeApiKey = async (req, res, next) => {
  try {
    const { userId, apiKey } = req.body;
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new AppError("User not found.", 404, "ERR_USER_NOT_FOUND");
    }

    targetUser.apiKeys = targetUser.apiKeys.filter(k => k !== apiKey);
    await targetUser.save();

    await log(targetUser._id, "API_KEY_REVOKED", "success", {
      requestId: req.requestId,
      message:   `API key revoked`,
    });

    successResponse(res, { userId: targetUser._id }, "API Key revoked successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. UPDATE WEBHOOK URL
// ─────────────────────────────────────────────────────────────
export const updateWebhookUrl = async (req, res, next) => {
  try {
    const user = req.user;
    const { webhookUrl } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      throw new AppError("A valid webhook URL (starting with http) is required.", 400, "ERR_INVALID_WEBHOOK_URL");
    }

    await User.findByIdAndUpdate(user._id, { webhookUrl });
    successResponse(res, { webhookUrl }, "Webhook URL updated successfully");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// 8. ADMIN: GET ALL ACTIVITY LOGS FOR THEIR CLIENTS
// ─────────────────────────────────────────────────────────────
export const getAdminActivityLogs = async (req, res, next) => {
  try {
    const adminUser = req.user;
    const {
      page      = 1,
      limit     = 20,
      eventType,
      status,
      startDate,
      endDate,
    } = req.query;

    // First find all clients assigned to this admin (or all if superadmin)
    let clientIds = [];
    if (adminUser.role === "super_admin") {
      const clients = await User.find({ role: "client" }).select("_id");
      clientIds = clients.map(c => c._id);
    } else {
      const clients = await User.find({ assignedAdmin: adminUser._id }).select("_id");
      clientIds = clients.map(c => c._id);
    }

    const filter = { userId: { $in: clientIds } };

    if (eventType) filter.eventType = eventType;
    if (status)    filter.status    = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await ActivityLog.countDocuments(filter);
    const logs  = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "name email");

    successResponse(res, {
      logs,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    }, "Activity logs fetched successfully for admin");

  } catch (err) {
    next(err);
  }
};
