import BaseRepository from "./base.repository.js";
import Notification from "../models/Notification.js";

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  findByUser(userId) {
    return this.find({ user: userId }, { limit: 20 });
  }

  markAllRead(userId) {
    return Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
  }

  countUnread(userId) {
    return this.count({ user: userId, isRead: false });
  }
}

export default new NotificationRepository();
