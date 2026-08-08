import AdLead from "../models/AdLead.js";
import Campaign from "../models/Campaign.js";
import axios from "axios";
import crypto from "crypto";

// ============================================================================
// META (FACEBOOK) WEBHOOKS
// ============================================================================

/**
 * Handle Meta Webhook Verification (hub.challenge)
 */
export const verifyMetaWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "diintech_meta_webhook_secret_2026";
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

/**
 * Handle incoming leads from Meta
 */
export const handleMetaLead = async (req, res) => {
  try {
    const body = req.body;

    // Verify it's from a page subscription
    if (body.object !== "page") {
      return res.sendStatus(404);
    }

    // Acknowledge receipt immediately to prevent Meta from retrying
    res.status(200).send("EVENT_RECEIVED");

    // Process entries asynchronously
    body.entry.forEach(async (entry) => {
      const changes = entry.changes;
      
      for (const change of changes) {
        if (change.field === "leadgen") {
          const leadgenData = change.value;
          const leadId = leadgenData.leadgen_id;
          const formId = leadgenData.form_id;
          const adId = leadgenData.ad_id;
          const adsetId = leadgenData.adgroup_id;
          
          try {
            // Check if lead already exists to prevent duplicates
            const exists = await AdLead.findOne({ leadId });
            if (exists) {
              console.log(`[Meta Webhook] Lead ${leadId} already processed. Skipping.`);
              continue;
            }

            // Fetch actual lead details from Meta Graph API
            const accessToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
            if (!accessToken) {
              console.error("[Meta Webhook] No access token available to fetch lead details.");
              continue;
            }

            const graphResponse = await axios.get(
              `https://graph.facebook.com/v19.0/${leadId}?access_token=${accessToken}`
            );
            
            const leadData = graphResponse.data;
            
            // Map field data
            const extractedFields = {
              fullName: "",
              email: "",
              phoneNumber: "",
              city: "",
              companyName: "",
            };
            const customAnswers = [];

            if (leadData.field_data) {
              leadData.field_data.forEach(field => {
                const val = field.values[0];
                switch (field.name) {
                  case "full_name": extractedFields.fullName = val; break;
                  case "first_name": extractedFields.firstName = val; break;
                  case "last_name": extractedFields.lastName = val; break;
                  case "email": extractedFields.email = val; break;
                  case "phone_number": extractedFields.phoneNumber = val; break;
                  case "city": extractedFields.city = val; break;
                  case "company_name": extractedFields.companyName = val; break;
                  default: 
                    customAnswers.push({ question: field.name, answer: val });
                }
              });
            }

            // Fallback for full name if split
            if (!extractedFields.fullName && (extractedFields.firstName || extractedFields.lastName)) {
              extractedFields.fullName = `${extractedFields.firstName || ""} ${extractedFields.lastName || ""}`.trim();
            }

            // Determine Campaign and User ID from ad ID context (Need a lookup mechanism)
            // For now, we will try to find a campaign that has this formId or adId
            const campaign = await Campaign.findOne({ $or: [{ "metaConfig.adId": adId }, { "metaConfig.formId": formId }] });
            
            if (!campaign) {
              console.warn(`[Meta Webhook] No active campaign found for ad ${adId} or form ${formId}. Saving as orphaned lead.`);
            }

            // Save Lead
            const newAdLead = new AdLead({
              campaignId: campaign ? campaign._id : null,
              userId: campaign ? campaign.userId : null,
              platform: "meta",
              leadId: leadId,
              formId: formId,
              adId: adId,
              adsetId: adsetId,
              ...extractedFields,
              customAnswers: customAnswers,
              rawPayload: leadData
            });

            await newAdLead.save();
            console.log(`[Meta Webhook] Successfully processed and saved lead ${leadId}`);

          } catch (err) {
            console.error(`[Meta Webhook] Error processing leadgen_id ${leadId}:`, err.response?.data || err.message);
          }
        }
      }
    });

  } catch (error) {
    console.error("[Meta Webhook] Uncaught error:", error);
    // Already sent 200 OK
  }
};


// ============================================================================
// GOOGLE WEBHOOKS
// ============================================================================

/**
 * Handle incoming leads from Google Ads (Lead Form Extensions)
 */
export const handleGoogleLead = async (req, res) => {
  try {
    const body = req.body;
    
    // Verify Google Webhook Key if configured
    const GOOGLE_WEBHOOK_KEY = process.env.GOOGLE_WEBHOOK_KEY;
    if (GOOGLE_WEBHOOK_KEY) {
      const providedKey = req.headers["authorization"] || req.query.key;
      if (providedKey !== GOOGLE_WEBHOOK_KEY) {
        console.warn("[Google Webhook] Invalid webhook key provided.");
        return res.status(401).json({ message: "Unauthorized webhook key." });
      }
    }

    const leadId = body.google_key || body.lead_id;
    if (!leadId) {
      return res.status(400).json({ message: "Missing lead identifier." });
    }

    // Check for duplicates
    const exists = await AdLead.findOne({ leadId, platform: "google" });
    if (exists) {
      console.log(`[Google Webhook] Lead ${leadId} already processed. Skipping.`);
      return res.status(200).send("Duplicate acknowledged");
    }

    // Map Google's user_column_data
    // Google payload format: { user_column_data: [ { column_name: "Full Name", string_value: "John Doe" }, ... ] }
    const extractedFields = {
      fullName: "",
      email: "",
      phoneNumber: "",
      city: "",
      companyName: "",
    };
    const customAnswers = [];

    if (body.user_column_data && Array.isArray(body.user_column_data)) {
      body.user_column_data.forEach(col => {
        const key = col.column_id || col.column_name;
        const val = col.string_value;
        
        // Normalize keys (Google uses UPPER_SNAKE_CASE for standard fields like FULL_NAME, EMAIL)
        switch (key?.toUpperCase()) {
          case "FULL_NAME": extractedFields.fullName = val; break;
          case "FIRST_NAME": extractedFields.firstName = val; break;
          case "LAST_NAME": extractedFields.lastName = val; break;
          case "EMAIL": extractedFields.email = val; break;
          case "PHONE_NUMBER": extractedFields.phoneNumber = val; break;
          case "CITY": extractedFields.city = val; break;
          case "COMPANY_NAME": extractedFields.companyName = val; break;
          default:
            customAnswers.push({ question: key, answer: val });
        }
      });
    }

    // Fallback for full name
    if (!extractedFields.fullName && (extractedFields.firstName || extractedFields.lastName)) {
      extractedFields.fullName = `${extractedFields.firstName || ""} ${extractedFields.lastName || ""}`.trim();
    }

    // Try to find context from campaign parameters passed in webhook (e.g. gclid, campaign_id)
    const campaignIdStr = body.campaign_id; 
    let campaign = null;
    
    if (campaignIdStr) {
      campaign = await Campaign.findOne({ "googleConfig.campaignId": campaignIdStr });
    }

    // Save Lead
    const newAdLead = new AdLead({
      campaignId: campaign ? campaign._id : null,
      userId: campaign ? campaign.userId : null,
      platform: "google",
      leadId: leadId,
      formId: body.form_id || null,
      adId: body.ad_id || null,
      adsetId: body.adgroup_id || null,
      ...extractedFields,
      customAnswers: customAnswers,
      rawPayload: body
    });

    await newAdLead.save();
    console.log(`[Google Webhook] Successfully processed and saved lead ${leadId}`);
    
    // Google expects a 200 OK
    res.status(200).send("OK");

  } catch (error) {
    console.error("[Google Webhook] Error processing lead:", error);
    res.status(500).send("Internal Server Error");
  }
};
