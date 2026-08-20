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
  pmax: "PERFORMANCE_MAX",
  demand_gen: "DEMAND_GEN",
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

      // Dynamic Bidding Strategy selection based on objective and type
      let biddingStrategy = {};
      if (campaign.googleAdType === "app") {
        biddingStrategy = {
          advertisingChannelSubType: "APP_CAMPAIGN",
          appCampaignSetting: {
            biddingStrategyGoalType: "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST",
            appId: campaign.appId,
            appStore: campaign.appStore || "GOOGLE_APP_STORE"
          },
          targetCpa: { targetCpaMicros: Math.round(effectiveDailyBudget * 1_000_000 / 10) },
        };
      } else {
        const obj = campaign.objective || "TRAFFIC";
        if (["pmax", "youtube", "video"].includes(campaign.googleAdType)) {
          biddingStrategy = { maximizeConversions: {} }; // PMax and Video Action require this
        } else if (obj === "TRAFFIC") {
          biddingStrategy = { targetSpend: {} };
        } else if (obj === "AWARENESS") {
          biddingStrategy = { manualCpm: {} };
        } else {
          biddingStrategy = { maximizeConversions: {} }; // Sales / Leads
        }
      }

      let startDateTimeStr = null;
      if (campaign.startDate) {
        const datePart = new Date(campaign.startDate).toISOString().slice(0, 10);
        startDateTimeStr = `${datePart} 00:00:00`;
      }

      let endDateTimeStr = null;
      if (campaign.endDate) {
        const datePart = new Date(campaign.endDate).toISOString().slice(0, 10);
        endDateTimeStr = `${datePart} 23:59:59`;
      }

      const campRes = await api.post("/campaigns:mutate", {
        operations: [{
          create: {
            name: `${campaign.name} ${timestamp}`,
            status: "PAUSED",
            advertisingChannelType: CHANNEL_MAP[campaign.googleAdType] || "SEARCH",
            ...(CHANNEL_MAP[campaign.googleAdType] === "VIDEO" && { 
              advertisingChannelSubType: "VIDEO_ACTION",
              audienceSetting: { useAudienceGrouped: true }
            }),
            campaignBudget: budgetId,
            ...biddingStrategy,
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
            ...(campaign.googleAdType === "pmax" && { brandGuidelinesEnabled: false }),
            ...(startDateTimeStr && { startDateTime: startDateTimeStr }),
            ...(endDateTimeStr && CHANNEL_MAP[campaign.googleAdType] !== "VIDEO" && { endDateTime: endDateTimeStr }),
          },
        }],
      });
      return campRes.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  setCampaignCriteria: async (creds, campaignResourceName, location, campaign = null, languageConstants = ["languageConstants/1000", "languageConstants/1023"]) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      const operations = [];

      for (const lang of languageConstants) {
        operations.push({
          create: {
            campaign: campaignResourceName,
            language: { languageConstant: lang }
          }
        });
      }

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

      if (campaign && campaign.scheduleDays && campaign.scheduleDays.length > 0) {
        let startHour = 0;
        let startMinute = "ZERO";
        if (campaign.startTime) {
          const parts = campaign.startTime.split(":");
          startHour = parseInt(parts[0]) || 0;
          const mins = parseInt(parts[1]) || 0;
          if (mins >= 45) startMinute = "FORTY_FIVE";
          else if (mins >= 30) startMinute = "THIRTY";
          else if (mins >= 15) startMinute = "FIFTEEN";
        }

        let endHour = 24;
        let endMinute = "ZERO";
        if (campaign.endTime) {
          const parts = campaign.endTime.split(":");
          endHour = parseInt(parts[0]) || 24;
          const mins = parseInt(parts[1]) || 0;
          if (mins >= 45) endMinute = "FORTY_FIVE";
          else if (mins >= 30) endMinute = "THIRTY";
          else if (mins >= 15) endMinute = "FIFTEEN";
        }

        for (const day of campaign.scheduleDays) {
          operations.push({
            create: {
              campaign: campaignResourceName,
              adSchedule: {
                dayOfWeek: day.toUpperCase(),
                startHour,
                startMinute,
                endHour,
                endMinute
              }
            }
          });
        }
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
      const isCpm = campaign.objective === "AWARENESS";
      const adGroupData = {
        name: `${campaign.name} - Ad Group`,
        campaign: campaignResourceName,
        status: "ENABLED",
      };

      if (campaign.googleAdType === "app") {
        // App Campaigns do not support manual cpc or cpm bidding at the ad group level
      } else if (["video", "youtube"].includes(campaign.googleAdType)) {
        adGroupData.type = "VIDEO_RESPONSIVE";
      } else if (isCpm) {
        adGroupData.cpmBidMicros = 1000000; // 1 INR CPM bid for Awareness campaigns
      } else {
        adGroupData.cpcBidMicros = 1000000; // 1 INR CPC bid for Clicks/Conversion campaigns
      }

      const res = await api.post("/adGroups:mutate", {
        operations: [{
          create: adGroupData,
        }],
      });
      return res.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  createPmaxAssetGroup: async (creds, campaignResourceName, campaign, googleAdCopy, imageUrls, logoUrl, businessName, finalUrl) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);
      
      let targetFinalUrl = finalUrl;
      if (targetFinalUrl && targetFinalUrl.startsWith("tel:")) {
        targetFinalUrl = "https://diintech.com"; // Fallback landing page for protocol validation
      }

      // 1. Create ALL Text Assets first to get their real Resource Names
      const headlines = googleAdCopy.headlines && googleAdCopy.headlines.length >= 3 
        ? googleAdCopy.headlines.slice(0, 5)
        : [googleAdCopy.headline || "Special Offer", "Learn More Today", "Contact Us Now"].slice(0, 5);
      
      const descriptions = googleAdCopy.descriptions && googleAdCopy.descriptions.length >= 2
        ? googleAdCopy.descriptions.slice(0, 4)
        : [googleAdCopy.primaryText || googleAdCopy.description || "Discover our amazing services", "Contact us today for more information."].slice(0, 4);

      const longHeadline = googleAdCopy.primaryText || googleAdCopy.description || "Discover our amazing services today";

      const textAssetsToCreate = [
        ...headlines.map(text => ({ type: "TEXT", textAsset: { text: cleanText(text, 30) } })),
        ...descriptions.map(text => ({ type: "TEXT", textAsset: { text: cleanText(text, 90) } })),
        { type: "TEXT", textAsset: { text: cleanText(longHeadline, 90) } },
        { type: "TEXT", textAsset: { text: cleanText(businessName || "Diin Tech", 25) } }
      ];

      const textRes = await api.post("/assets:mutate", {
        operations: textAssetsToCreate.map(asset => ({ create: asset }))
      });
      
      const textResourceNames = textRes.data.results.map(r => r.resourceName);
      let tIdx = 0;
      const headlineResNames = headlines.map(() => textResourceNames[tIdx++]);
      const descResNames = descriptions.map(() => textResourceNames[tIdx++]);
      const longHeadlineResName = textResourceNames[tIdx++];
      const businessNameResName = textResourceNames[tIdx++];

      // 2. Create ALL Image Assets
      const uniqueImages = [...new Set(imageUrls)].filter(Boolean);
      let marketingImageRes = null;
      let squareImageRes = null;
      
      if (uniqueImages.length > 0) {
        marketingImageRes = await GoogleAdsService.uploadImageAsset(creds, uniqueImages[0], "landscape");
        squareImageRes = await GoogleAdsService.uploadImageAsset(creds, uniqueImages[0], "square");
      }
      
      let logoRes = null;
      if (logoUrl) {
        logoRes = await GoogleAdsService.uploadImageAsset(creds, logoUrl, "square");
      } else if (uniqueImages.length > 0) {
        logoRes = squareImageRes; // Fallback to square image if no logo is provided
      }

      // 3. Batch Mutate to create AssetGroup AND link AssetGroupAssets SIMULTANEOUSLY
      const mutateOperations = [];
      const tempAssetGroupId = `customers/${creds.customerId}/assetGroups/-1`;

      mutateOperations.push({
        assetGroupOperation: {
          create: {
            resourceName: tempAssetGroupId,
            name: `${campaign.name} - Asset Group ${Date.now()}`,
            campaign: campaignResourceName,
            status: "ENABLED",
            finalUrls: [targetFinalUrl]
          }
        }
      });

      const addLink = (assetResourceName, fieldType) => {
        if (assetResourceName) {
          mutateOperations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: tempAssetGroupId,
                asset: assetResourceName,
                fieldType: fieldType
              }
            }
          });
        }
      };

      headlineResNames.forEach(res => addLink(res, "HEADLINE"));
      descResNames.forEach(res => addLink(res, "DESCRIPTION"));
      addLink(longHeadlineResName, "LONG_HEADLINE");
      addLink(businessNameResName, "BUSINESS_NAME");
      addLink(marketingImageRes, "MARKETING_IMAGE");
      addLink(squareImageRes, "SQUARE_MARKETING_IMAGE");
      addLink(logoRes, "LOGO");

      const batchRes = await api.post("/googleAds:mutate", { mutateOperations });
      
      console.log(`[Google Ads] Successfully created Asset Group for PMax via Bulk Mutate`);
      
      // Find the real resource name from the batch response
      const assetGroupResponse = batchRes.data.mutateOperationResponses.find(r => r.assetGroupResult);
      return assetGroupResponse ? assetGroupResponse.assetGroupResult.resourceName : null;
    } catch (err) {
      console.error("[Google Ads] PMax Asset Group error:", JSON.stringify(err.response?.data, null, 2) || err.message);
      throw err;
    }
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

  createAd: async (creds, adGroupResourceName, googleAdCopy, adType = "search", finalUrl = "https://www.example.com", imageUrl = null, businessName = "Diin Tech", videoUrl = null, imageUrls = []) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      let targetFinalUrl = finalUrl;
      if (targetFinalUrl && targetFinalUrl.startsWith("tel:")) {
        targetFinalUrl = "https://diintech.com"; // Fallback landing page for protocol validation (diintech.com is active)
      }

      let videoAssetResourceName = "";
      let activeImageUrl = imageUrl;

      // If videoUrl is provided, use it. Otherwise fall back to checking if imageUrl is a YouTube URL.
      const targetVideoUrl = videoUrl || (extractYoutubeVideoId(imageUrl) ? imageUrl : null);
      if (targetVideoUrl) {
        const videoId = extractYoutubeVideoId(targetVideoUrl);
        if (videoId) {
          videoAssetResourceName = await registerYoutubeVideoAsset(creds, videoId);
          // If we registered a video but have no separate image, use the cover thumbnail for display ads
          if (!imageUrl) {
            activeImageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          }
        }
      }

      // Fallbacks in case old schema is passed
      const headlines = googleAdCopy.headlines && googleAdCopy.headlines.length > 0 
        ? googleAdCopy.headlines.map(h => ({ text: cleanText(h, 30) }))
        : [{ text: cleanText(googleAdCopy.headline || "Special Offer", 30) }, { text: cleanText(googleAdCopy.description || "Learn More", 30) }, { text: "Special Offer Today" }];
      
      const descriptions = googleAdCopy.descriptions && googleAdCopy.descriptions.length > 0
        ? googleAdCopy.descriptions.map(d => ({ text: cleanText(d, 90) }))
        : [{ text: cleanText(googleAdCopy.primaryText || googleAdCopy.description || "Discover our amazing services", 90) }, { text: "Contact us today for more information." }];

      const allImages = [...(imageUrls || []), activeImageUrl].filter(Boolean);
      const uniqueImages = [...new Set(allImages)];

      let adPayload;
      if (adType === "search") {
        adPayload = {
          responsiveSearchAd: { headlines, descriptions },
          finalUrls: [targetFinalUrl],
        };
      } else if (adType === "display") {
        let marketingImages = [];
        let squareMarketingImages = [];
        
        for (const img of uniqueImages) {
          const landscape = await GoogleAdsService.uploadImageAsset(creds, img, "landscape");
          const square = await GoogleAdsService.uploadImageAsset(creds, img, "square");
          if (landscape) marketingImages.push({ asset: landscape });
          if (square) squareMarketingImages.push({ asset: square });
        }

        const uniqueMarketing = [...new Set(marketingImages.map(img => img.asset))];
        const uniqueSquare = [...new Set(squareMarketingImages.map(img => img.asset))];
        
        adPayload = {
          responsiveDisplayAd: {
            headlines: [headlines[0]],
            longHeadline: descriptions[0], // up to 90 chars
            descriptions: [descriptions[0]],
            businessName: cleanText(businessName || "Diin Tech", 25),
            marketingImages: uniqueMarketing.map(asset => ({ asset })),
            squareMarketingImages: uniqueSquare.map(asset => ({ asset })),
            youtubeVideos: videoAssetResourceName ? [{ asset: videoAssetResourceName }] : [],
          },
          finalUrls: [targetFinalUrl],
        };
      } else if (adType === "app") {
        let appImages = [];
        
        for (const img of uniqueImages) {
          const landscape = await GoogleAdsService.uploadImageAsset(creds, img, "landscape");
          const square = await GoogleAdsService.uploadImageAsset(creds, img, "square");
          if (landscape) appImages.push({ asset: landscape });
          if (square) appImages.push({ asset: square });
        }

        const uniqueAppImages = [...new Set(appImages.map(img => img.asset))];
        
        adPayload = {
          appAd: {
            headlines: headlines.slice(0, 5),
            descriptions: descriptions.slice(0, 5),
            images: uniqueAppImages.map(asset => ({ asset })),
            youtubeVideos: videoAssetResourceName ? [{ asset: videoAssetResourceName }] : []
          }
        };
      } else {
        adPayload = {
          videoResponsiveAd: {
            headlines: [{ text: cleanText(googleAdCopy.videoHeadline || googleAdCopy.headline || "Special Offer", 15) }],
            longHeadlines: [{ text: cleanText(googleAdCopy.primaryText || googleAdCopy.description || "Discover our amazing services today", 90) }],
            descriptions: [{ text: cleanText(googleAdCopy.description || "Contact us today for more information.", 90) }],
            callToActions: [{ text: cleanText(googleAdCopy.cta || "Learn More", 10) }],
            videos: videoAssetResourceName ? [{ asset: videoAssetResourceName }] : [],
          },
          finalUrls: [targetFinalUrl],
        };
      }

      const res = await api.post("/adGroupAds:mutate", {
        operations: [{ create: { adGroup: adGroupResourceName, status: "ENABLED", ad: adPayload } }],
      });
      return res.data.results[0].resourceName;
    } catch (err) { handleError(err); }
  },

  addCallAssetToCampaign: async (creds, campaignResourceName, telLink) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      // Parse phone number
      let clean = telLink.replace("tel:", "").replace(/[+\s()-]/g, "");
      let countryCode = "IN";
      let number = clean;
      if (clean.startsWith("91") && clean.length === 12) {
        number = clean.slice(2);
      }

      // 1. Create CALL asset
      const assetRes = await api.post("/assets:mutate", {
        operations: [{
          create: {
            type: "CALL",
            name: `CallAsset_${clean}_${Date.now()}`,
            callAsset: {
              countryCode,
              phoneNumber: number,
              callConversionReportingState: "DISABLED"
            }
          }
        }]
      });
      const assetResourceName = assetRes.data.results[0].resourceName;

      // 2. Link CALL asset to the campaign
      await api.post("/campaignAssets:mutate", {
        operations: [{
          create: {
            campaign: campaignResourceName,
            asset: assetResourceName,
            fieldType: "CALL"
          }
        }]
      });
      console.log(`[Google Ads] Successfully linked Call Asset ${assetResourceName} to Campaign ${campaignResourceName}`);
    } catch (err) {
      console.error("[Google Ads] Failed to add Call Asset to campaign:", err.response?.data || err.message);
    }
  },

  addLeadFormAssetToCampaign: async (creds, campaignResourceName, businessName, formTitle, formDescription, webhookUrl, webhookKey) => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      // Create LEAD_FORM asset
      const assetRes = await api.post("/assets:mutate", {
        operations: [{
          create: {
            type: "LEAD_FORM",
            name: `LeadForm_${Date.now()}`,
            leadFormAsset: {
              businessName: cleanText(businessName || "Diin Tech", 25),
              headline: cleanText(formTitle || "Get in Touch", 30),
              description: cleanText(formDescription || "Fill the form below to receive more details.", 90),
              privacyPolicyUrl: "https://diintech.com/privacy-policy",
              postSubmitHeadline: "Thank You!",
              postSubmitDescription: "We have received your details and will get back to you shortly.",
              callToActionType: "LEARN_MORE",
              callToActionDescription: "Apply now for details.",
              fields: [
                { inputType: "FULL_NAME" },
                { inputType: "EMAIL" },
                { inputType: "PHONE_NUMBER" }
              ],
              deliveryMethods: [
                {
                  webhook: {
                    advertiserWebhookUrl: webhookUrl,
                    googleSecret: webhookKey,
                    payloadSchemaVersion: 3
                  }
                }
              ]
            }
          }
        }]
      });
      const assetResourceName = assetRes.data.results[0].resourceName;

      // Link LEAD_FORM asset to the campaign
      await api.post("/campaignAssets:mutate", {
        operations: [{
          create: {
            campaign: campaignResourceName,
            asset: assetResourceName,
            fieldType: "LEAD_FORM"
          }
        }]
      });
      console.log(`[Google Ads] Successfully linked Lead Form Asset ${assetResourceName} to Campaign ${campaignResourceName}`);
      return assetResourceName;
    } catch (err) {
      console.error("[Google Ads] Failed to add Lead Form Asset to campaign:", JSON.stringify(err.response?.data, null, 2) || err.message);
    }
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
