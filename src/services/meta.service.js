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

      let optimization_goal = "REACH";
      let promoted_object = undefined;
      const obj = payload.objective || "TRAFFIC";

      if (obj === "TRAFFIC") {
        optimization_goal = "LINK_CLICKS";
      } else if (obj === "CONVERSIONS" || obj === "SALES") {
        optimization_goal = "OFFSITE_CONVERSIONS";
        if (payload.pixelId) {
          promoted_object = {
            pixel_id: payload.pixelId,
            custom_event_type: "LEAD"
          };
        }
      } else if (obj === "APP_PROMOTION") {
        optimization_goal = "APP_INSTALLS";
        if (payload.appId) {
          promoted_object = {
            application_id: payload.appId,
            object_store_url: payload.appStoreUrl
          };
        }
      } else if (obj === "LEADS") {
        optimization_goal = "LEAD_GENERATION";
        const pageId = payload.pageId || process.env.META_PAGE_ID;
        if (pageId) {
          promoted_object = { page_id: pageId };
        }
      } else if (obj === "ENGAGEMENT") {
        optimization_goal = "POST_ENGAGEMENT";
      }

      console.log("[DEBUG createAdSet] Objective:", obj);
      console.log("[DEBUG createAdSet] Optimization Goal:", optimization_goal);
      console.log("[DEBUG createAdSet] Promoted Object:", promoted_object);

      let startTime = payload.startDate ? new Date(payload.startDate) : new Date();
      let startTimeStr = payload.startDate || startTime.toISOString();
      
      // If start time is in the past, adjust it to current time + 10 mins
      if (startTime.getTime() < Date.now()) {
        startTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins future
        startTimeStr = startTime.toISOString();
        console.log("[DEBUG createAdSet] Adjusted Start Time to:", startTimeStr);
      }

      let endTimeStr = payload.endDate;
      if (endTimeStr) {
        let endTime = new Date(endTimeStr);
        const diffHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) {
          endTime = new Date(startTime.getTime() + 24.5 * 60 * 60 * 1000); // Add 24.5 hours to adjusted start time
          endTimeStr = endTime.toISOString();
          console.log("[DEBUG createAdSet] Adjusted End Time to:", endTimeStr);
        }
      }

      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/adsets`, {
        name: payload.name,
        campaign_id: payload.metaCampaignId,
        daily_budget: effectiveDailyBudget, // in paise (INR smallest unit)
        billing_event: "IMPRESSIONS",
        optimization_goal: optimization_goal,
        promoted_object: promoted_object,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        status: "PAUSED",
        targeting: buildTargeting(payload.targeting),
        start_time: startTimeStr,
        end_time: endTimeStr || undefined,
      });
      return data;
    } catch (err) { handleMetaError(err); }
  },

  // ─── Lead Gen Form ─────────────────────────────────────────
  createLeadGenForm: async (accessToken, pageId, payload) => {
    try {
      const formPayload = {
        name: `Lead Form - ${payload.name} - ${Date.now()}`,
        questions: [
          { type: "FULL_NAME" },
          { type: "EMAIL" },
          { type: "PHONE" }
        ],
        privacy_policy: {
          url: payload.link || "https://diintech.com/privacy-policy",
          link_text: "Privacy Policy"
        },
        follow_up_action_url: payload.link || "https://diintech.com",
        status: "ACTIVE"
      };

      const { data } = await metaClient(accessToken).post(`/${pageId}/leadgen_forms`, formPayload);
      return data.id; // Returns lead_gen_form_id
    } catch (err) { handleMetaError(err); }
  },

  // ─── Ad Creative + Ad ──────────────────────────────────────
  createAdCreative: async (accessToken, adAccountId, payload) => {
    try {
        let ctaType = (payload.adCopy.cta || "LEARN_MORE").toUpperCase().replace(/[^A-Z_]/g, '').replace(/\s+/g, '_');
        const VALID_CTAS = ["BOOK_TRAVEL","CONTACT_US","DONATE","DONATE_NOW","DOWNLOAD","GET_DIRECTIONS","GO_LIVE","INTERESTED","LEARN_MORE","SEE_DETAILS","LIKE_PAGE","MESSAGE_PAGE","RAISE_MONEY","SAVE","SEND_TIP","SHOP_NOW","SIGN_UP","VIEW_INSTAGRAM_PROFILE","INSTAGRAM_MESSAGE","LOYALTY_LEARN_MORE","PURCHASE_GIFT_CARDS","PAY_TO_ACCESS","SEE_MORE","TRY_IN_CAMERA","WHATSAPP_LINK","GET_IN_TOUCH","TRY_NOW","ASK_A_QUESTION","START_A_CHAT","CHAT_NOW","ASK_US","CHAT_WITH_US","BOOK_NOW","CHECK_AVAILABILITY","ORDER_NOW","WHATSAPP_MESSAGE","GET_MOBILE_APP","INSTALL_MOBILE_APP","USE_MOBILE_APP","INSTALL_APP","USE_APP","PLAY_GAME","TRY_DEMO","WATCH_VIDEO","WATCH_MORE","OPEN_LINK","NO_BUTTON","LISTEN_MUSIC","MOBILE_DOWNLOAD","GET_OFFER","GET_OFFER_VIEW","BUY_NOW","BUY_TICKETS","UPDATE_APP","BET_NOW","ADD_TO_CART","SELL_NOW","GET_SHOWTIMES","LISTEN_NOW","GET_EVENT_TICKETS","REMIND_ME","SEARCH_MORE","PRE_REGISTER","SWIPE_UP_PRODUCT","SWIPE_UP_SHOP","PLAY_GAME_ON_FACEBOOK","VISIT_WORLD","OPEN_INSTANT_APP","JOIN_GROUP","GET_PROMOTIONS","SEND_UPDATES","INQUIRE_NOW","VISIT_PROFILE","CHAT_ON_WHATSAPP","EXPLORE_MORE","CONFIRM","JOIN_CHANNEL","MAKE_AN_APPOINTMENT","ASK_ABOUT_SERVICES","BOOK_A_CONSULTATION","GET_A_QUOTE","BUY_VIA_MESSAGE","ASK_FOR_MORE_INFO","VIEW_PRODUCT","VIEW_CHANNEL","WATCH_LIVE_VIDEO","JOIN_LIVE_VIDEO","IMAGINE","CALL","MISSED_CALL","CALL_NOW","CALL_ME","APPLY_NOW","BUY","GET_QUOTE","SUBSCRIBE","RECORD_NOW","VOTE_NOW","GIVE_FREE_RIDES","REGISTER_NOW","OPEN_MESSENGER_EXT","EVENT_RSVP","CIVIC_ACTION","SEND_INVITES","REFER_FRIENDS","REQUEST_TIME","SEE_MENU","SEARCH","TRY_IT","TRY_ON","LINK_CARD","DIAL_CODE","FIND_YOUR_GROUPS","START_ORDER"];
        if (!VALID_CTAS.includes(ctaType)) ctaType = "LEARN_MORE";

        // Workaround for unlinked WhatsApp numbers: Force WhatsApp CTAs to "LEARN_MORE" 
        // so Facebook treats the wa.me URL as a normal website, preventing API rejections.
        if (["WHATSAPP_MESSAGE", "WHATSAPP_LINK", "CHAT_ON_WHATSAPP"].includes(ctaType)) {
            ctaType = "LEARN_MORE";
        }

        const objectStorySpec = { page_id: payload.pageId };
        
        let leadGenFormId = null;
        if (payload.objective === "LEADS") {
          leadGenFormId = await MetaService.createLeadGenForm(accessToken, payload.pageId, payload);
          ctaType = "SIGN_UP"; // Usually preferred for lead forms
        }

        const ctaValue = leadGenFormId 
          ? { lead_gen_form_id: leadGenFormId }
          : { link: payload.link || "https://example.com" };

        if (payload.videoId) {
          objectStorySpec.video_data = {
            video_id: payload.videoId,
            message: payload.adCopy.primaryText,
            title: payload.adCopy.headline,
            call_to_action: { type: ctaType, value: ctaValue }
          };
          if (payload.thumbnailUrl) {
            objectStorySpec.video_data.image_url = payload.thumbnailUrl;
          } else if (payload.imageUrl && !payload.imageUrl.endsWith(".mp4") && !payload.imageUrl.includes("/video/upload/")) {
            objectStorySpec.video_data.image_url = payload.imageUrl; 
          }
        } else {
          const carouselMedia = (payload.mediaList || []).filter(media => media.type === 'image');
          if (carouselMedia.length > 1) {
            // Carousel Ad (Filtered to Images Only for Meta safety)
            objectStorySpec.link_data = {
              message: payload.adCopy.primaryText,
              link: payload.link || "https://example.com",
              child_attachments: carouselMedia.map(media => ({
                link: payload.link || "https://example.com",
                image_hash: media.id,
                name: payload.adCopy.headline,
                description: payload.adCopy.description,
                call_to_action: { type: ctaType, value: ctaValue }
              })),
              multi_share_optimized: true,
              multi_share_end_card: false
            };
          } else {
            // Fallback to Single Image Ad
            const singleImageHash = (carouselMedia.length > 0) ? carouselMedia[0].id : payload.imageHash;
            objectStorySpec.link_data = {
              message: payload.adCopy.primaryText,
              link: payload.link || "https://example.com",
              name: payload.adCopy.headline,
              description: payload.adCopy.description,
              call_to_action: { type: ctaType, value: ctaValue },
              ...(singleImageHash ? { image_hash: singleImageHash } : (payload.imageUrl && { picture: payload.imageUrl })),
            };
          }
        }

        const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/adcreatives`, {
        name: `${payload.name}_creative`,
        object_story_spec: objectStorySpec,
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

  uploadVideo: async (accessToken, adAccountId, videoUrl) => {
    try {
      const { data } = await metaClient(accessToken).post(`/act_${adAccountId}/advideos`, {
        file_url: videoUrl
      });
      return data.id;
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

  getLiveCampaignDetails: async (accessToken, metaCampaignId) => {
    try {
      const { data } = await metaClient(accessToken).get(`/${metaCampaignId}`, {
        params: {
          fields: "id,name,status,effective_status,issues_info,adsets{id,name,status,effective_status,targeting},ads{id,name,status,effective_status,creative{id,name},recommendations,issues_info,ad_review_feedback}"
        }
      });
      return data;
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
const buildTargeting = (targeting = {}) => {
  const spec = {
    age_min: targeting.ageMin || 18,
    age_max: targeting.ageMax || 65,
    targeting_automation: {
      advantage_audience: 0
    },
    ...(targeting.genders?.length && { genders: targeting.genders }),
    geo_locations: {
      custom_locations: targeting.locations?.filter(l => l.lat && l.lng).map((l) => ({
        latitude: l.lat,
        longitude: l.lng,
        radius: l.radius || 10,
        distance_unit: "kilometer"
      })) || [],
      countries: targeting.locations?.length && targeting.locations.some(l => l.lat) ? [] : ["IN"],
    },
    ...(targeting.interests?.length && {
      flexible_spec: [{ interests: targeting.interests.map((i) => ({ id: i.id, name: i.name })) }],
    }),
  };

  if (targeting.publisher_platforms && targeting.publisher_platforms.length > 0) {
    spec.publisher_platforms = targeting.publisher_platforms;
    spec.device_platforms = ["mobile", "desktop"];
  }

  return spec;
};

export default MetaService;
