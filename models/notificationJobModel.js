
const mongoose = require("mongoose");

const notificationJobSchema = new mongoose.Schema(
  {
    reminderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reminder",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    offsetMinutes: {
      type: Number,
      enum: [360, 60, 15],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      default: "",
    },

    // Exact time when FCM should be sent
    sendAt: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    processingAt: {
      type: Date,
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// A reminder can have only one job per lead time.
notificationJobSchema.index(
  { reminderId: 1, offsetMinutes: 1 },
  { unique: true }
);

notificationJobSchema.index({ status: 1, sendAt: 1 });

module.exports = mongoose.model(
  "NotificationJob",
  notificationJobSchema
);
