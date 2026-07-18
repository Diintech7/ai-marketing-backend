import nodemailer from "nodemailer";
import EmailCampaign from "../models/EmailCampaign.js";
import EmailRecipient from "../models/EmailRecipient.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const EmailService = {
  createCampaign: async (user, payload) => {
    // payload: { name, subject, body, emails: ["a@a.com", "b@b.com"], status: "draft" | "active" }
    const campaign = await EmailCampaign.create({
      user: user._id,
      name: payload.name,
      subject: payload.subject,
      body: payload.body,
      status: payload.status || "draft",
      totalRecipients: payload.emails ? payload.emails.length : 0,
    });

    if (payload.emails && payload.emails.length > 0) {
      const recipients = payload.emails.map(email => ({
        campaign: campaign._id,
        user: user._id,
        email,
        status: "pending"
      }));
      await EmailRecipient.insertMany(recipients);
    }
    return campaign;
  },

  updateCampaignStatus: async (campaignId, status) => {
    return EmailCampaign.findByIdAndUpdate(campaignId, { status }, { new: true });
  },

  getCampaignsByUser: async (userId) => {
    const campaigns = await EmailCampaign.find({ user: userId }).sort({ createdAt: -1 }).lean();
    
    // Attach live stats to each campaign
    const statsPromises = campaigns.map(async (c) => {
      const sent = await EmailRecipient.countDocuments({ campaign: c._id, status: "sent" });
      const failed = await EmailRecipient.countDocuments({ campaign: c._id, status: "failed" });
      const pending = await EmailRecipient.countDocuments({ campaign: c._id, status: "pending" });
      return { ...c, stats: { sent, failed, pending } };
    });

    return Promise.all(statsPromises);
  },

  // Runs every minute via node-cron
  processEmailQueue: async () => {
    console.log("[Email Scheduler] Checking for pending emails...");
    try {
      // 1. Get all active campaigns
      const activeCampaigns = await EmailCampaign.find({ status: "active" }).select("_id user subject body");
      if (activeCampaigns.length === 0) return;

      const campaignIds = activeCampaigns.map(c => c._id);
      
      // We need to group processing by User, since rate limits (300/day, 5/min) apply PER USER.
      const users = [...new Set(activeCampaigns.map(c => c.user.toString()))];

      // Get today's start and end date to check daily limit
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      for (const userId of users) {
        // Check how many sent today by this user
        const sentTodayCount = await EmailRecipient.countDocuments({
          user: userId,
          status: "sent",
          sentAt: { $gte: startOfDay, $lte: endOfDay }
        });

        if (sentTodayCount >= 300) {
          console.log(`[Email Scheduler] User ${userId} reached daily limit of 300. Skipping.`);
          continue;
        }

        // Fetch up to 5 pending emails for this user (Minute limit)
        const pendingEmails = await EmailRecipient.find({
          user: userId,
          campaign: { $in: campaignIds },
          status: "pending"
        }).limit(5).populate("campaign"); // We populate to get subject and body

        if (pendingEmails.length === 0) {
          // If no pending emails left for this user's campaigns, maybe mark them as completed
          for (const camp of activeCampaigns.filter(c => c.user.toString() === userId)) {
            const stillPending = await EmailRecipient.countDocuments({ campaign: camp._id, status: "pending" });
            if (stillPending === 0) {
              await EmailCampaign.findByIdAndUpdate(camp._id, { status: "completed" });
            }
          }
          continue;
        }

        // Send the 5 emails
        for (const recipient of pendingEmails) {
          const campaign = recipient.campaign; // populated object
          try {
            await transporter.sendMail({
              from: `"${process.env.FROM_NAME || 'AI Marketing'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
              to: recipient.email,
              subject: campaign.subject,
              html: campaign.body,
            });

            // Mark as sent
            recipient.status = "sent";
            recipient.sentAt = new Date();
            await recipient.save();
          } catch (error) {
            console.error(`[Email Scheduler] Failed to send email to ${recipient.email}:`, error.message);
            recipient.status = "failed";
            recipient.error = error.message;
            await recipient.save();
          }
        }
        
        console.log(`[Email Scheduler] Sent ${pendingEmails.length} emails for user ${userId}.`);
      }
    } catch (err) {
      console.error("[Email Scheduler] Error processing queue:", err);
    }
  }
};

export default EmailService;
