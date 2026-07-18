import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import AIUsage from "../models/AIUsage.js";
import Payment from "../models/Payment.js";

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const AnalyticsService = {
  // ─── Overview Stats ──────────────────────────────────────────
  getOverview: async (userId) => {
    const uid = toObjectId(userId);

    const [campaignStats, aiStats, spendStats] = await Promise.all([
      Campaign.aggregate([
        { $match: { user: uid } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalSpend: { $sum: "$insights.spend" },
            totalImpressions: { $sum: "$insights.impressions" },
            totalClicks: { $sum: "$insights.clicks" },
            totalReach: { $sum: "$insights.reach" },
          },
        },
      ]),
      AIUsage.aggregate([
        { $match: { user: uid } },
        {
          $group: {
            _id: null,
            totalUsage: { $sum: 1 },
            totalCredits: { $sum: "$creditsUsed" },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { user: uid, status: "paid" } },
        { $group: { _id: null, totalPaid: { $sum: "$amount" } } },
      ]),
    ]);

    // Flatten campaign stats by status
    const byStatus = { draft: 0, active: 0, paused: 0, completed: 0, deleted: 0 };
    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalReach = 0;
    for (const s of campaignStats) {
      byStatus[s._id] = s.count;
      totalSpend += s.totalSpend;
      totalImpressions += s.totalImpressions;
      totalClicks += s.totalClicks;
      totalReach += s.totalReach;
    }

    return {
      campaigns: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        ...byStatus,
      },
      performance: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalReach,
        avgCTR: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
        avgCPC: totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0,
      },
      ai: {
        totalUsage: aiStats[0]?.totalUsage || 0,
        totalCreditsUsed: aiStats[0]?.totalCredits || 0,
      },
      payments: {
        totalPaid: spendStats[0]?.totalPaid || 0,
      },
    };
  },

  // ─── Campaign Performance (last N campaigns) ─────────────────
  getCampaignPerformance: async (userId, limit = 10) => {
    const uid = toObjectId(userId);
    return Campaign.aggregate([
      { $match: { user: uid, status: { $in: ["active", "paused", "completed"] } } },
      { $sort: { "insights.spend": -1 } },
      { $limit: Number(limit) },
      {
        $project: {
          name: 1,
          status: 1,
          objective: 1,
          "insights.impressions": 1,
          "insights.clicks": 1,
          "insights.spend": 1,
          "insights.reach": 1,
          "insights.ctr": 1,
          "insights.cpc": 1,
          createdAt: 1,
        },
      },
    ]);
  },

  // ─── AI Usage by Tool (for pie/bar chart) ────────────────────
  getAIUsageByTool: async (userId) => {
    const uid = toObjectId(userId);
    return AIUsage.aggregate([
      { $match: { user: uid } },
      {
        $group: {
          _id: "$tool",
          count: { $sum: 1 },
          creditsUsed: { $sum: "$creditsUsed" },
        },
      },
      { $sort: { count: -1 } },
    ]);
  },

  // ─── AI Usage Over Time (last 30 days, daily) ────────────────
  getAIUsageTrend: async (userId) => {
    const uid = toObjectId(userId);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    return AIUsage.aggregate([
      { $match: { user: uid, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          creditsUsed: { $sum: "$creditsUsed" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, creditsUsed: 1, _id: 0 } },
    ]);
  },

  // ─── Campaigns Created Over Time (last 30 days) ──────────────
  getCampaignTrend: async (userId) => {
    const uid = toObjectId(userId);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    return Campaign.aggregate([
      { $match: { user: uid, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, _id: 0 } },
    ]);
  },

  // ─── Top Performing Campaigns ────────────────────────────────
  getTopCampaigns: async (userId, metric = "clicks", limit = 5) => {
    const uid = toObjectId(userId);
    const sortField = `insights.${["clicks", "impressions", "reach", "spend"].includes(metric) ? metric : "clicks"}`;

    return Campaign.aggregate([
      { $match: { user: uid } },
      { $sort: { [sortField]: -1 } },
      { $limit: Number(limit) },
      {
        $project: {
          name: 1,
          status: 1,
          "insights.clicks": 1,
          "insights.impressions": 1,
          "insights.spend": 1,
          "insights.reach": 1,
          "insights.ctr": 1,
        },
      },
    ]);
  },
};

export default AnalyticsService;
