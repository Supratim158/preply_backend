const mongoose = require("mongoose");
const User = require("../models/userModel");
const Reminder = require("../models/reminderModel");
const Notification = require("../models/notificationModel");
const { getTodayDate } = require("./notificationScheduler");

// Register FCM token for push notifications
exports.registerToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "Valid FCM token is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $addToSet: {
          fcmTokens: token.trim(),
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Device registered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register device",
      error: error.message,
    });
  }
};

// GET /api/notification - Get all active notifications for the logged in user
// Automatically cleans up notifications where reminder date is gone or reminder is marked done/missed
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();

    // 1. Clean up notifications whose reminder date has passed
    await Notification.deleteMany({
      userId,
      reminderDate: { $lt: today },
    });

    // 2. Clean up notifications whose reminders are already done or missed
    const inactiveReminders = await Reminder.find({
      userId,
      status: { $in: ["done", "missed"] },
    }).select("_id");

    if (inactiveReminders.length > 0) {
      const inactiveIds = inactiveReminders.map((r) => r._id);
      await Notification.deleteMany({
        userId,
        reminderId: { $in: inactiveIds },
      });
    }

    // 3. Clean up orphaned notifications (reminder deleted directly)
    const existingReminders = await Reminder.find({ userId }).select("_id");
    const existingReminderIdSet = new Set(
      existingReminders.map((r) => r._id.toString())
    );

    const userNotifications = await Notification.find({ userId });
    const orphanIds = userNotifications
      .filter((n) => !existingReminderIdSet.has(n.reminderId?.toString()))
      .map((n) => n._id);

    if (orphanIds.length > 0) {
      await Notification.deleteMany({ _id: { $in: orphanIds } });
    }

    // 4. Fetch the active notifications
    const notifications = await Notification.find({ userId }).sort({
      createdAt: -1,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// PATCH /api/notification/:id/read - Mark single notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: { isRead: true } },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

// PATCH /api/notification/read-all - Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

// DELETE /api/notification/:id - Dismiss / delete a single notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

// DELETE /api/notification - Clear all notifications for user
exports.clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to clear notifications",
      error: error.message,
    });
  }
};
