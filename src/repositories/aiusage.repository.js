import BaseRepository from "./base.repository.js";
import AIUsage from "../models/AIUsage.js";

class AIUsageRepository extends BaseRepository {
  constructor() {
    super(AIUsage);
  }

  findByUser(userId, options = {}) {
    return this.find({ user: userId }, options);
  }

  totalCreditsUsed(userId) {
    return AIUsage.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$creditsUsed" } } },
    ]);
  }

  usageByTool(userId) {
    return AIUsage.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$tool", count: { $sum: 1 }, credits: { $sum: "$creditsUsed" } } },
    ]);
  }
}

export default new AIUsageRepository();
