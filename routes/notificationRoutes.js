const express = require("express");
const router = express.Router();

const {
  registerToken,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} = require("../controllers/notificationController");

const { verifyTokenAndAuthorization } = require("../middleware/verifyToken");

// Fetch all active in-app notifications
router.get("/", verifyTokenAndAuthorization, getNotifications);

// Mark all notifications as read
router.patch("/read-all", verifyTokenAndAuthorization, markAllNotificationsAsRead);

// Mark single notification as read
router.patch("/:id/read", verifyTokenAndAuthorization, markNotificationAsRead);

// Clear all notifications
router.delete("/", verifyTokenAndAuthorization, clearAllNotifications);

// Delete/dismiss single notification
router.delete("/:id", verifyTokenAndAuthorization, deleteNotification);

// Register FCM device token
router.post(
  "/register-token",
  verifyTokenAndAuthorization,
  registerToken
);

module.exports = router;
