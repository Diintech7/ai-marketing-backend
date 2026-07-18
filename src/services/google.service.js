import axios from "axios";
import AppError from "../utils/AppError.js";


const BASE = "https://googleads.googleapis.com/v23";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const getAccessToken = async (refreshToken) => {
  try {
    const { data } = await axios.post(TOKEN_URL, {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
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
    timeout: 20000,
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
            manualCpc: {},
            ...(campaign.startDate && { startDateTime: `${campaign.startDate.toISOString().slice(0, 10)} 00:00:00` }),
            ...(campaign.endDate && { endDateTime: `${campaign.endDate.toISOString().slice(0, 10)} 23:59:59` }),
          },
        }],
      });
      return campRes.data.results[0].resourceName;
    } catch (err) { handleError(err); }
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

  createAd: async (creds, adGroupResourceName, adCopy, adType = "search") => {
    try {
      const token = await getAccessToken(creds.refreshToken);
      const api = client(token, creds.developerToken, creds.customerId);

      let adPayload;
      if (adType === "search") {
        adPayload = {
          responsiveSearchAd: {
            headlines: [{ text: adCopy.headline }, { text: adCopy.description || adCopy.headline }],
            descriptions: [{ text: adCopy.primaryText || adCopy.description }],
          },
          finalUrls: ["https://example.com"],
        };
      } else if (adType === "display") {
        adPayload = {
          responsiveDisplayAd: {
            headlines: [{ text: adCopy.headline }],
            descriptions: [{ text: adCopy.primaryText || adCopy.description }],
            marketingImages: [],
            squareMarketingImages: [],
          },
          finalUrls: ["https://example.com"],
        };
      } else {
        adPayload = {
          videoAd: {
            video: { resourceName: "" },
            inStream: { actionHeadline: adCopy.headline },
          },
          finalUrls: ["https://example.com"],
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
  removeCampaign: (creds, id) => GoogleAdsService.updateStatus(creds, id, "REMOVED"),

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
