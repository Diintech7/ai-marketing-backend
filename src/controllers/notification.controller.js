import Notification from "../models/Notification.js";

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
      
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { isRead: true });
    } else {
      // Mark all as read
      await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
