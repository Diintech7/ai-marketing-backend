import axios from "axios";
import ActivityLog from "../models/ActivityLog.js";

/**
 * WebhookService
 * Sends a POST notification to the partner's webhookUrl whenever a campaign status changes.
 */
const WebhookService = {
  /**
   * @param {Object} user       - The user document (must have webhookUrl)
   * @param {Object} campaign   - The campaign document
   * @param {String} eventType  - e.g. "campaign.status_changed"
   * @param {String} status     - e.g. "active", "failed", "paused"
   * @param {String} requestId  - The X-Request-Id of the original API call
   */
  async send(user, campaign, eventType, status, requestId = null) {
    if (!user?.webhookUrl) return; // No webhook configured — skip silently

    const payload = {
      event:      eventType,            // e.g. "campaign.status_changed"
      timestamp:  new Date().toISOString(),
      requestId:  requestId,
      data: {
        campaignId:   campaign._id.toString(),
        campaignName: campaign.name,
        platform:     campaign.platform,
        status:       status,
        updatedAt:    new Date().toISOString(),
      },
    };

    try {
      await axios.post(user.webhookUrl, payload, {
        timeout: 8000,
        headers: {
          "Content-Type":    "application/json",
          "X-Diintech-Event": eventType,
        },
      });

      // Log success
      await ActivityLog.create({
        userId:    user._id,
        requestId: requestId,
        eventType: "WEBHOOK_SENT",
        status:    "success",
        campaignId: campaign._id,
        message:   `Webhook delivered to ${user.webhookUrl}`,
        meta:      { eventType, status },
      });

    } catch (err) {
      // Log failure but do NOT crash the main flow
      console.warn(`[Webhook] Failed to deliver to ${user.webhookUrl}:`, err.message);
      await ActivityLog.create({
        userId:    user._id,
        requestId: requestId,
        eventType: "WEBHOOK_FAILED",
        status:    "error",
        campaignId: campaign._id,
        errorCode: "WEBHOOK_DELIVERY_FAILED",
        message:   err.message,
        meta:      { webhookUrl: user.webhookUrl, eventType, status },
      });
    }
  },
};

export default WebhookService;
