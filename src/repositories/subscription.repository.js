import BaseRepository from "./base.repository.js";
import Subscription from "../models/Subscription.js";

class SubscriptionRepository extends BaseRepository {
  constructor() {
    super(Subscription);
  }

  findByUser(userId) {
    return this.findOne({ user: userId });
  }

  upsertByUser(userId, data) {
    return Subscription.findOneAndUpdate(
      { user: userId },
      { ...data, user: userId },
      { new: true, upsert: true }
    );
  }
}

export default new SubscriptionRepository();
