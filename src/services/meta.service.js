import { metaClient } from "../config/meta.js";
import AppError from "../utils/AppError.js";

const handleMetaError = (err) => {
  console.error("META API ERROR DETAILS:", JSON.stringify(err.response?.data, null, 2));
  const errorObj = err.response?.data?.error || {};
  let msg = errorObj.error_user_msg || errorObj.message || "Meta API error";
  if (errorObj.error_data) msg += ` - ${JSON.stringify(errorObj.error_data)}`;
  throw new AppError(msg, err.response?.status || 500);
};

const MetaService = {
  // ─── Account ───────────────────────────────────────────────
  getAdAccount: async (accessToken, adAccountId) => {
    try {
      const { data } = await metaClient(accessToken).get(`/act_${adAccountId}`, {
        params: { fields: "id,name,currency,account_status,balance" },
      });
      return data;
    } catch (err) { handleMetaError(err); }
  },

  // ─── Campaign ──────────────────────────────────────────────
  createCampaign: async (accessToken, adAccountId, payload) => {
    try {
      const objectiveMap = {
        AWARENESS: "OUTCOME_AWARENESS",
        TRAFFIC: "OUTCOME_TRAFFIC",
        ENGAGEMENT: "OUTCOME_ENGAGEMENT",
        LEADS: "OUTCOME_LEADS",
        SALES: "OUTCOME_SALES",
        APP_PROMOTION: "OUTCOME_APP_PROMOTION"
      };
      const metaObjective = objectiveMap[payload.objective] || "OUTCOME_AWARENESS";

      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/campaigns`, {
        name: payload.name,
        objective: metaObjective,
        status: "PAUSED",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false
      });
      return data; // { id }
    } catch (err) { handleMetaError(err); }
  },

  updateCampaign: async (accessToken, metaCampaignId, updates) => {
    try {
      const { data } = await metaClient(accessToken).post(`/${metaCampaignId}`, updates);
      return data;
    } catch (err) { handleMetaError(err); }
  },

  publishCampaign: (accessToken, metaCampaignId) =>
    MetaService.updateCampaign(accessToken, metaCampaignId, { status: "ACTIVE" }),

  pauseCampaign: (accessToken, metaCampaignId) =>
    MetaService.updateCampaign(accessToken, metaCampaignId, { status: "PAUSED" }),

  deleteCampaign: async (accessToken, metaCampaignId) => {
    try {
      const { data } = await metaClient(accessToken).delete(`/${metaCampaignId}`);
      return data;
    } catch (err) { handleMetaError(err); }
  },

  // ─── Ad Set ────────────────────────────────────────────────
  createAdSet: async (accessToken, adAccountId, payload) => {
    try {
      let effectiveDailyBudget = payload.budget * 100;
      if (payload.budgetType === "weekly") {
        effectiveDailyBudget = Math.round((payload.budget * 100) / 7);
      } else if (payload.budgetType === "monthly") {
        effectiveDailyBudget = Math.round((payload.budget * 100) / 30);
      } else if (payload.budgetType === "lifetime") {
        if (payload.startDate && payload.endDate) {
          const days = Math.max(1, Math.ceil((new Date(payload.endDate) - new Date(payload.startDate)) / (1000 * 60 * 60 * 24)));
          effectiveDailyBudget = Math.round((payload.budget * 100) / days);
        } else {
          effectiveDailyBudget = Math.round((payload.budget * 100) / 30);
        }
      }

      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/adsets`, {
        name: payload.name,
        campaign_id: payload.metaCampaignId,
        daily_budget: effectiveDailyBudget, // in paise (INR smallest unit)
        billing_event: "IMPRESSIONS",
        optimization_goal: "REACH",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        status: "PAUSED",
        targeting: buildTargeting(payload.targeting),
        start_time: payload.startDate || undefined,
        end_time: payload.endDate || undefined,
      });
      return data;
    } catch (err) { handleMetaError(err); }
  },

  // ─── Ad Creative + Ad ──────────────────────────────────────
  createAdCreative: async (accessToken, adAccountId, payload) => {
    try {
        let ctaType = (payload.adCopy.cta || "LEARN_MORE").toUpperCase().replace(/[^A-Z_]/g, '').replace(/\s+/g, '_');
        const VALID_CTAS = ["BOOK_TRAVEL","CONTACT_US","DONATE","DONATE_NOW","DOWNLOAD","GET_DIRECTIONS","GO_LIVE","INTERESTED","LEARN_MORE","SEE_DETAILS","LIKE_PAGE","MESSAGE_PAGE","RAISE_MONEY","SAVE","SEND_TIP","SHOP_NOW","SIGN_UP","VIEW_INSTAGRAM_PROFILE","INSTAGRAM_MESSAGE","LOYALTY_LEARN_MORE","PURCHASE_GIFT_CARDS","PAY_TO_ACCESS","SEE_MORE","TRY_IN_CAMERA","WHATSAPP_LINK","GET_IN_TOUCH","TRY_NOW","ASK_A_QUESTION","START_A_CHAT","CHAT_NOW","ASK_US","CHAT_WITH_US","BOOK_NOW","CHECK_AVAILABILITY","ORDER_NOW","WHATSAPP_MESSAGE","GET_MOBILE_APP","INSTALL_MOBILE_APP","USE_MOBILE_APP","INSTALL_APP","USE_APP","PLAY_GAME","TRY_DEMO","WATCH_VIDEO","WATCH_MORE","OPEN_LINK","NO_BUTTON","LISTEN_MUSIC","MOBILE_DOWNLOAD","GET_OFFER","GET_OFFER_VIEW","BUY_NOW","BUY_TICKETS","UPDATE_APP","BET_NOW","ADD_TO_CART","SELL_NOW","GET_SHOWTIMES","LISTEN_NOW","GET_EVENT_TICKETS","REMIND_ME","SEARCH_MORE","PRE_REGISTER","SWIPE_UP_PRODUCT","SWIPE_UP_SHOP","PLAY_GAME_ON_FACEBOOK","VISIT_WORLD","OPEN_INSTANT_APP","JOIN_GROUP","GET_PROMOTIONS","SEND_UPDATES","INQUIRE_NOW","VISIT_PROFILE","CHAT_ON_WHATSAPP","EXPLORE_MORE","CONFIRM","JOIN_CHANNEL","MAKE_AN_APPOINTMENT","ASK_ABOUT_SERVICES","BOOK_A_CONSULTATION","GET_A_QUOTE","BUY_VIA_MESSAGE","ASK_FOR_MORE_INFO","VIEW_PRODUCT","VIEW_CHANNEL","WATCH_LIVE_VIDEO","JOIN_LIVE_VIDEO","IMAGINE","CALL","MISSED_CALL","CALL_NOW","CALL_ME","APPLY_NOW","BUY","GET_QUOTE","SUBSCRIBE","RECORD_NOW","VOTE_NOW","GIVE_FREE_RIDES","REGISTER_NOW","OPEN_MESSENGER_EXT","EVENT_RSVP","CIVIC_ACTION","SEND_INVITES","REFER_FRIENDS","REQUEST_TIME","SEE_MENU","SEARCH","TRY_IT","TRY_ON","LINK_CARD","DIAL_CODE","FIND_YOUR_GROUPS","START_ORDER"];
        if (!VALID_CTAS.includes(ctaType)) ctaType = "LEARN_MORE";

        const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/adcreatives`, {
        name: `${payload.name}_creative`,
        object_story_spec: {
          page_id: payload.pageId,
          link_data: {
            message: payload.adCopy.primaryText,
            link: payload.link || "https://example.com",
            name: payload.adCopy.headline,
            description: payload.adCopy.description,
            call_to_action: { 
              type: ctaType,
              value: { link: payload.link || "https://example.com" }
            },
            ...(payload.imageHash ? { image_hash: payload.imageHash } : (payload.imageUrl && { picture: payload.imageUrl })),
          },
        },
      });
      return data;
    } catch (err) { handleMetaError(err); }
  },

  createAd: async (accessToken, adAccountId, payload) => {
    try {
      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/ads`, {
        name: payload.name,
        adset_id: payload.metaAdSetId,
        creative: { creative_id: payload.creativeId },
        status: "PAUSED",
      });
      return data;
    } catch (err) { handleMetaError(err); }
  },

  uploadImage: async (accessToken, adAccountId, imageUrl) => {
    try {
      const axios = (await import("axios")).default;
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgRes.data, 'binary');

      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      let dataStr = '--' + boundary + '\r\n';
      dataStr += 'Content-Disposition: form-data; name="filename"; filename="ad.jpg"\r\n';
      dataStr += 'Content-Type: image/jpeg\r\n\r\n';
      
      const payload = Buffer.concat([
        Buffer.from(dataStr, 'utf8'),
        buffer,
        Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8'),
      ]);

      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/adimages`, payload, {
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
      });
      
      const hash = Object.values(data.images)[0]?.hash;
      return hash;
    } catch (err) { handleMetaError(err); }
  },

  // ─── Insights ──────────────────────────────────────────────
  getCampaignInsights: async (accessToken, metaCampaignId, dateRange = "last_30d") => {
    try {
      const { data } = await metaClient(accessToken).get(`/${metaCampaignId}/insights`, {
        params: {
          fields: "impressions,clicks,spend,reach,ctr,cpc,actions",
          date_preset: dateRange,
        },
      });
      return data.data?.[0] || {};
    } catch (err) { handleMetaError(err); }
  },

  getAccountInsights: async (accessToken, adAccountId, dateRange = "last_30d") => {
    try {
      const { data } = await metaClient(accessToken).get(`/act_${adAccountId}/insights`, {
        params: {
          fields: "impressions,clicks,spend,reach,ctr,cpc",
          date_preset: dateRange,
          level: "campaign",
        },
      });
      return data.data || [];
    } catch (err) { handleMetaError(err); }
  },
};

// ─── Targeting Builder ─────────────────────────────────────
const buildTargeting = (targeting = {}) => ({
  age_min: targeting.ageMin || 18,
  age_max: targeting.ageMax || 65,
  ...(targeting.genders?.length && { genders: targeting.genders }),
  geo_locations: {
    cities: targeting.locations?.map((l) => ({
      key: l.city,
      country: l.country || "IN",
    })) || [],
    countries: targeting.locations?.length ? [] : ["IN"],
  },
  ...(targeting.interests?.length && {
    flexible_spec: [{ interests: targeting.interests.map((i) => ({ id: i.id, name: i.name })) }],
  }),
});

export default MetaService;
