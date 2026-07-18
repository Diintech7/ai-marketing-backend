import BaseRepository from "./base.repository.js";
import Campaign from "../models/Campaign.js";

class CampaignRepository extends BaseRepository {
  constructor() {
    super(Campaign);
  }

  findByUser(userId, options = {}) {
    return this.find({ user: userId }, options);
  }

  findByUserAndId(userId, campaignId) {
    return this.findOne({ _id: campaignId, user: userId });
  }

  countByUser(userId) {
    return this.count({ user: userId });
  }

  countActiveByUser(userId) {
    return this.count({ user: userId, status: "active" });
  }

  updateInsights(campaignId, insights) {
    return this.updateById(campaignId, { insights });
  }
}

export default new CampaignRepository();
