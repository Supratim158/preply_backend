const cron = require("node-cron");
const mongoose = require("mongoose");

const { messaging } = require("../config/firebase");
const Reminder = require("../models/reminderModel");
const NotificationJob = require("../models/notificationJobModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");

const MAX_ATTEMPTS = 5;

// Today's date in India: YYYY-MM-DD
const getTodayDate = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = {};
  parts.forEach(({ type, value }) => {
    values[type] = value;
  });

  return `${values.year}-${values.month}-${values.day}`;
};

// Convert reminder date/time in India into a real UTC timestamp.
// Example: 2026-10-12 10:30 becomes 10:30 IST.
const getReminderDateTime = (date, time) => {
  return new Date(`${date}T${time}:00+05:30`);
};

const notificationMessage = (job) => {
  if (job.offsetMinutes === 360) {
    return "Your reminder is coming up in 6 hours.";
  }

  if (job.offsetMinutes === 60) {
    return "Your reminder is coming up in 1 hour.";
  }

  return "Your reminder is coming up in 15 minutes.";
};

const isInvalidTokenError = (code) => [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
].includes(code);

// Send to all registered devices for one user.
async function sendToUser(user, job) {
  const tokens = [...new Set(user.fcmTokens || [])];

  if (tokens.length === 0) {
    console.log(
      `User ${user._id} has no registered FCM devices; skipping push delivery`
    );
    return;
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: job.title,
      body: job.body,
    },
    data: {
      type: "reminder",
      reminderId: String(job.reminderId),
      offsetMinutes: String(job.offsetMinutes),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "reminders",
        sound: "default",
      },
    },
  });

  // Remove expired/unregistered tokens from MongoDB.
  const invalidTokens = [];

  response.responses.forEach((result, index) => {
    if (
      !result.success &&
      isInvalidTokenError(result.error?.code)
    ) {
      invalidTokens.push(tokens[index]);
    }
  });

  if (invalidTokens.length > 0) {
    await User.updateOne(
      { _id: user._id },
      { $pull: { fcmTokens: { $in: invalidTokens } } }
    );
  }

  if (response.successCount === 0) {
    throw new Error(
      response.responses
        .filter((result) => !result.success)
        .map((result) => result.error?.code || "FCM send failed")
        .join(", ")
    );
  }

  console.log(
    `Reminder notification sent: ${job._id}; ` +
    `${response.successCount} device(s)`
  );
}

// Process one job safely.
async function processJob(job) {
  const claimedJob = await NotificationJob.findOneAndUpdate(
    {
      _id: job._id,
      status: "pending",
    },
    {
      $set: {
        status: "processing",
        processingAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  // Another worker may already have claimed it.
  if (!claimedJob) return;

  try {
    // Do not send reminders that were completed, deleted,
    // or are no longer pending.
    const reminder = await Reminder.findOne({
      _id: claimedJob.reminderId,
      userId: claimedJob.userId,
      status: "pending",
    });

    if (!reminder) {
      await NotificationJob.updateOne(
        { _id: claimedJob._id, status: "processing" },
        { $set: { status: "cancelled" } }
      );
      return;
    }

    const user = await User.findById(claimedJob.userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Store in-app notification in MongoDB so frontend can fetch it
    await Notification.findOneAndUpdate(
      {
        reminderId: reminder._id,
        offsetMinutes: claimedJob.offsetMinutes,
      },
      {
        userId: claimedJob.userId,
        reminderId: reminder._id,
        title: claimedJob.title,
        body: claimedJob.body,
        offsetMinutes: claimedJob.offsetMinutes,
        reminderDate: reminder.date,
        reminderTime: reminder.time,
        isRead: false,
      },
      { upsert: true, returnDocument: 'after' }
    );

    await sendToUser(user, claimedJob);

    await NotificationJob.updateOne(
      { _id: claimedJob._id, status: "processing" },
      {
        $set: {
          status: "sent",
          sentAt: new Date(),
          lastError: "",
        },
        $inc: { attempts: 1 },
      }
    );
  } catch (error) {
    const attempts = claimedJob.attempts + 1;
    const nextStatus =
      attempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await NotificationJob.updateOne(
      { _id: claimedJob._id, status: "processing" },
      {
        $set: {
          status: nextStatus,
          lastError: error.message,
        },
        $inc: { attempts: 1 },
      }
    );

    console.error(
      `Notification job ${claimedJob._id} failed:`,
      error.message
    );
  }
}

async function processDueJobs() {
  // Clean up notifications whose reminder date has passed
  const today = getTodayDate();
  await Notification.deleteMany({ reminderDate: { $lt: today } });

  // Recover jobs left in processing if the server crashed.
  await NotificationJob.updateMany(
    {
      status: "processing",
      processingAt: {
        $lt: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
    {
      $set: {
        status: "pending",
        processingAt: null,
      },
    }
  );

  const jobs = await NotificationJob.find({
    status: "pending",
    sendAt: { $lte: new Date() },
  })
    .sort({ sendAt: 1 })
    .limit(100)
    .lean();

  for (const job of jobs) {
    await processJob(job);
  }
}

let schedulerStarted = false;

function startNotificationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Every minute, using the server's local timezone.
  cron.schedule("* * * * *", () => {
    processDueJobs().catch((error) => {
      console.error("Notification scheduler error:", error);
    });
  });

  // Process already-due jobs immediately at startup.
  processDueJobs().catch((error) => {
    console.error("Initial notification job error:", error);
  });

  console.log("Reminder notification scheduler started");
}

module.exports = {
  startNotificationScheduler,
  getReminderDateTime,
  getTodayDate,
};
