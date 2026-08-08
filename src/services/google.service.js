import axios from "axios";
import https from "https";
import AppError from "../utils/AppError.js";

const httpsAgent = new https.Agent({ keepAlive: true });

const BASE = "https://googleads.googleapis.com/v23";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const getAccessToken = async (refreshToken) => {
  try {
    const { data } = await axios.post(TOKEN_URL, {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }, { httpsAgent });
    return data.access_token;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || "Failed to get Google access token";
    console.error("[GoogleAds OAuth Error]", msg);
    throw new AppError(`Google OAuth: ${msg}`, 400);
  }
};

const client = (accessToken, developerToken, customerId) => {
  const cleanId = customerId.replace(/-/g, "");
  const baseURL = `${BASE}/customers/${cleanId}`;
  console.log("[GoogleAds] baseURL:", baseURL);

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };

  const managerId = process.env.GOOGLE_MANAGER_CUSTOMER_ID;
  if (managerId && cleanId !== managerId.replace(/-/g, "")) {
    headers["login-customer-id"] = managerId.replace(/-/g, "");
  }

  return axios.create({
    baseURL,
    headers,
    timeout: 30000,
    httpsAgent,
  });
};

const handleError = (err) => {
  const status = err.response?.status;
  const msg = err.response?.data?.error?.message
    || err.response?.data?.[0]?.error?.errors?.[0]?.message
    || err.message
    || "Google Ads API error";
  console.error("[GoogleAds Error]", status, msg);
  console.error("[GoogleAds Error Detail]", JSON.stringify(err.response?.data, null, 2));
  const appStatus = status === 401 || status === 403 ? 400 : (status || 500);
  throw new AppError(`Google Ads: ${msg}`, appStatus);
};

const CHANNEL_MAP = {
  search: "SEARCH",
  display: "DISPLAY",
  youtube: "VIDEO",
  app: "MULTI_CHANNEL",
};

const cleanText = (text, maxLength) => {
  if (!text) return "";
  let cleaned = text.replace(/[\u{10000}-\u{10FFFF}]/gu, '');
  return cleaned.trim().substring(0, maxLength).trim();
};

const extractYoutubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const registerYoutubeVideoAsset = async (creds, videoId) => {
  try {
    const token = await getAccessToken(creds.refreshToken);
    const api = client(token, creds.developerToken, creds.customerId);
    
    console.log("[Google Ads] Registering YouTube video asset for ID:", videoId);
    
    const res = await api.post("/assets:mutate", {
      operations: [{
        create: {
          type: "YOUTUBE_VIDEO",
          youtubeVideoAsset: { youtubeVideoId: videoId },
          name: `YT_Video_${videoId}_${Date.now()}`
        }
      }]
    });
    
    const resourceName = res.data.results?.[0]?.resourceName;
    console.log("[Google Ads] YouTube video asset created successfully:", resourceName);
    return resourceName;
  } catch (err) {
    console.error("[Google Ads] YouTube video asset registration failed:", err.response?.data || err.message);
    throw new AppError("Failed to register YouTube video asset", 400);
  }
};

const GoogleAdsService = {
  createCampaign: async (creds, campaign) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      const timestamp = Date.now();

      let effectiveDailyBudget = campaign.budget;
      if (campaign.budgetType === "weekly") {
        effectiveDailyBudget = Math.round(campaign.budget / 7);
      } else if (campaign.budgetType === "monthly") {
        effectiveDailyBudget = Math.round(campaign.budget / 30);
      } else if (campaign.budgetType === "lifetime") {
        if (campaign.startDate && campaign.endDate) {
          const days = Math.max(1, Math.ceil((new Date(campaign.endDate) - new Date(campaign.startDate)) / (1000 * 60 * 60 * 24)));
          effectiveDailyBudget = Math.round(campaign.budget / days);
        } else {
          effectiveDailyBudget = Math.round(campaign.budget / 30);
        }
      }

      const budgetRes = await api.post("/campaignBudgets:mutate", {
        operations: [{
          create: {
            name: `${campaign.name} Budget ${timestamp}`,
            amountMicros: effectiveDailyBudget * 1_000_000,
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        }],
      });
      const budgetId = budgetRes.data.results[0].resourceName;

      const campRes = await api.post("/campaigns:mutate", {
        operations: [{
          create: {
            name: `${campaign.name} ${timestamp}`,
            status: "PAUSED",
            advertisingChannelType: CHANNEL_MAP[campaign.googleAdType] || "SEARCH",
            campaignBudget: budgetId,
            ...(campaign.googleAdType === "app" ? {
              advertisingChannelSubType: "APP_CAMPAIGN",
              appCampaignSetting: {
                biddingStrategyGoalType: "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST",
                appId: campaign.appId,
                appStore: campaign.appStore || "GOOGLE_APP_STORE"
              },
              targetCpa: { targetCpaMicros: effectiveDailyBudget * 1_000_000 / 10 },
            } : {
              maximizeConversions: {},
            }),
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
            ...(campaign.startDate && { startDateTime: new Date(campaign.startDate).toISOString().slice(0, 10) + " 00:00:00" }),
            ...(campaign.endDate && { endDateTime: new Date(campaign.endDate).toISOString().slice(0, 10) + " 23:59:59" }),
          },
        }],
      });
      return campRes.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  setCampaignCriteria: async (creds, campaignResourceName, location, languageConstants = ["languageConstants/1000", "languageConstants/1023"]) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const operations = [];

      // Language Criteria
      for (const lang of languageConstants) {
        operations.push({
          create: {
            campaign: campaignResourceName,
            language: { languageConstant: lang }
          }
        });
      }

      // Location Proximity Criterion
      if (location && location.lat && location.lng && location.radius) {
        operations.push({
          create: {
            campaign: campaignResourceName,
            proximity: {
              geoPoint: {
                latitudeInMicroDegrees: Math.round(location.lat * 1_000_000),
                longitudeInMicroDegrees: Math.round(location.lng * 1_000_000)
              },
              radius: location.radius,
              radiusUnits: "KILOMETERS"
            }
          }
        });
      }

      if (operations.length > 0) {
        await api.post("/campaignCriteria:mutate", { operations });
      }
    } catch (err) {
      console.error("[Google Ads] Campaign criteria error:", err.response?.data || err.message);
    }
  },

  createAdGroup: async (creds, campaignResourceName, campaign) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const res = await api.post("/adGroups:mutate", {
        operations: [{
          create: {
            name: `${campaign.name} - Ad Group`,
            campaign: campaignResourceName,
            status: "ENABLED",
            cpcBidMicros: 1_000_000,
          },
        }],
      });
      return res.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  addKeywordsToAdGroup: async (creds, adGroupResourceName, keywords) => {
    if (!keywords || keywords.length === 0) return;
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const operations = keywords.map(kw => ({
        create: {
          adGroup: adGroupResourceName,
          status: "ENABLED",
          keyword: { text: kw, matchType: "BROAD" }
        }
      }));
      await api.post("/adGroupCriteria:mutate", { operations });
    } catch (err) {
      console.error("[Google Ads] Failed to add keywords:", err.response?.data || err.message);
    }
  },

  uploadImageAsset: async (creds, imageUrl, type = "square") => {
    try {
      if (!imageUrl) return null;
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const sharp = (await import('sharp')).default;

      // Fetch image
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      let buffer = Buffer.from(response.data, 'binary');

      if (type === "landscape") {
        buffer = await sharp(buffer).resize(1200, 628, { fit: 'cover' }).toBuffer(); // 1.91:1
      } else {
        buffer = await sharp(buffer).resize(1024, 1024, { fit: 'cover' }).toBuffer(); // 1:1
      }
      
      const base64Data = buffer.toString('base64');

      const res = await api.post("/assets:mutate", {
        operations: [{
          create: {
            type: "IMAGE",
            imageAsset: { data: base64Data },
            name: `AI_Image_${type}_${Date.now()}`
          }
        }]
      });
      return res.data.results[0].resourceName;
    } catch (err) {
      console.error("[Google Ads] Image upload failed:", err.response?.data || err.message);
      return null;
    }
  },

  createAd: async (creds, adGroupResourceName, googleAdCopy, adType = "search", finalUrl = "https://www.example.com", imageUrl = null, businessName = "Diin Tech") => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      let videoAssetResourceName = "";
      let activeImageUrl = imageUrl;

      // If imageUrl is a YouTube video, register it and use the cover thumbnail for image assets
      const videoId = extractYoutubeVideoId(imageUrl);
      if (videoId) {
        videoAssetResourceName = await registerYoutubeVideoAsset(creds, videoId);
        activeImageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }

      // Fallbacks in case old schema is passed
      const headlines = googleAdCopy.headlines && googleAdCopy.headlines.length > 0 
        ? googleAdCopy.headlines.map(h => ({ text: cleanText(h, 30) }))
        : [{ text: cleanText(googleAdCopy.headline || "Special Offer", 30) }, { text: cleanText(googleAdCopy.description || "Learn More", 30) }, { text: "Special Offer Today" }];
      
      const descriptions = googleAdCopy.descriptions && googleAdCopy.descriptions.length > 0
        ? googleAdCopy.descriptions.map(d => ({ text: cleanText(d, 90) }))
        : [{ text: cleanText(googleAdCopy.primaryText || googleAdCopy.description || "Discover our amazing services", 90) }, { text: "Contact us today for more information." }];

      let adPayload;
      if (adType === "search") {
        adPayload = {
          responsiveSearchAd: { headlines, descriptions },
          finalUrls: [finalUrl],
        };
      } else if (adType === "display") {
        let landscapeAsset = null;
        let squareAsset = null;
        
        if (activeImageUrl) {
          landscapeAsset = await GoogleAdsService.uploadImageAsset(creds, activeImageUrl, "landscape");
          squareAsset = await GoogleAdsService.uploadImageAsset(creds, activeImageUrl, "square");
        }
        
        adPayload = {
          responsiveDisplayAd: {
            headlines: [headlines[0]],
            longHeadline: descriptions[0], // up to 90 chars
            descriptions: [descriptions[0]],
            businessName: cleanText(businessName || "Diin Tech", 25),
            marketingImages: landscapeAsset ? [{ asset: landscapeAsset }] : [],
            squareMarketingImages: squareAsset ? [{ asset: squareAsset }] : [],
            youtubeVideos: videoAssetResourceName ? [{ asset: videoAssetResourceName }] : [],
          },
          finalUrls: [finalUrl],
        };
      } else if (adType === "app") {
        let landscapeAsset = null;
        let squareAsset = null;
        
        if (activeImageUrl) {
          landscapeAsset = await GoogleAdsService.uploadImageAsset(creds, activeImageUrl, "landscape");
          squareAsset = await GoogleAdsService.uploadImageAsset(creds, activeImageUrl, "square");
        }
        
        adPayload = {
          appAd: {
            headlines: headlines,
            descriptions: descriptions,
            images: landscapeAsset ? [{ asset: landscapeAsset }] : (squareAsset ? [{ asset: squareAsset }] : []),
            youtubeVideos: videoAssetResourceName ? [{ asset: videoAssetResourceName }] : []
          }
        };
      } else {
        adPayload = {
          videoAd: {
            video: { resourceName: videoAssetResourceName || "" },
            inStream: { actionHeadline: cleanText(googleAdCopy.videoHeadline || googleAdCopy.headline || "Special Offer", 15) },
          },
          finalUrls: [finalUrl],
        };
      }

      const res = await api.post("/adGroupAds:mutate", {
        operations: [{ create: { adGroup: adGroupResourceName, status: "ENABLED", ad: adPayload } }],
      });
      return res.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  updateStatus: async (creds, googleCampaignId, status) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      await api.post("/campaigns:mutate", {
        operations: [{ update: { resourceName: googleCampaignId, status }, updateMask: "status" }],
      });
    } catch (err) { handleError(err); }
  },

  enableCampaign: (creds, id) => GoogleAdsService.updateStatus(creds, id, "ENABLED"),
  pauseCampaign: (creds, id) => GoogleAdsService.updateStatus(creds, id, "PAUSED"),
  removeCampaign: async (creds, googleCampaignId) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      await api.post("/campaigns:mutate", {
        operations: [{ remove: googleCampaignId }],
      });
    } catch (err) { handleError(err); }
  },

  getInsights: async (creds, googleCampaignId) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const query = `
        SELECT campaign.id, metrics.impressions, metrics.clicks,
               metrics.cost_micros, metrics.ctr, metrics.average_cpc
        FROM campaign
        WHERE campaign.resource_name = '${googleCampaignId}'
          AND segments.date DURING LAST_30_DAYS
      `;
      const res = await api.post("/googleAds:searchStream", { query });
      const row = res.data?.[0]?.results?.[0]?.metrics || {};
      return {
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        spend: (Number(row.costMicros) || 0) / 1_000_000,
        ctr: Number(row.ctr) || 0,
        cpc: (Number(row.averageCpc) || 0) / 1_000_000,
      };
    } catch (err) { handleError(err); }
  },
};

export default GoogleAdsService;
