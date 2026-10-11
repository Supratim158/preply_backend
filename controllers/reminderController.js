
const mongoose = require('mongoose');
const Reminder = require('../models/reminderModel');
const NotificationJob = require('../models/notificationJobModel');
const Notification = require('../models/notificationModel');
const {
  getReminderDateTime,
} = require('../controllers/notificationScheduler');

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

// Validate a real calendar date, not just its format.
const isValidDate = (date) => {
  if (typeof date !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const isValidTime = (time) =>
  typeof time === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

// Convert expired pending reminders to missed.
// A reminder due today remains pending until tomorrow.
const updateMissedReminders = async (userId) => {
  const today = getTodayDate();

  await Reminder.updateMany(
    {
      userId,
      date: { $lt: today },
      status: 'pending',
    },
    {
      $set: { status: 'missed' },
    }
  );

  // Clean up notifications whose reminder date has passed
  await Notification.deleteMany({
    userId,
    reminderDate: { $lt: today },
  });
};

// POST /api/reminders
const createReminder = async (req, res) => {
  try {
    const { title, description, date, time } = req.body;

    if (
      typeof title !== 'string' ||
      !title.trim() ||
      !date ||
      !time
    ) {
      return res.status(400).json({
        success: false,
        message: 'Title, date, and time are required',
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date. Use YYYY-MM-DD.',
      });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time. Use 24-hour HH:mm format.',
      });
    }

    if (
      description !== undefined &&
      typeof description !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Description must be a string',
      });
    }

    
const today = getTodayDate();

const reminderAt = getReminderDateTime(date, time);

// Do not create a reminder for a time that has already passed.
if (reminderAt <= new Date()) {
  return res.status(400).json({
    success: false,
    message: "Reminder date and time must be in the future",
  });
}

const reminder = await Reminder.create({
  userId: req.user.id,
  title: title.trim(),
  description: description?.trim() || "",
  date,
  time,
  status: "pending",
});

// Schedule notifications 6 hours, 1 hour and 15 minutes
// before the reminder, but only if those times are still ahead.
const offsets = [360, 60, 15];
const now = new Date();

const jobs = offsets
  .map((offsetMinutes) => {
    const sendAt = new Date(
      reminderAt.getTime() - offsetMinutes * 60 * 1000
    );

    return {
      reminderId: reminder._id,
      userId: req.user.id,
      offsetMinutes,
      title: `Preply Reminder: ${reminder.title}`,
      body:
        offsetMinutes === 360
          ? `Your reminder is in 6 hours: ${reminder.title}`
          : offsetMinutes === 60
          ? `Your reminder is in 1 hour: ${reminder.title}`
          : `Your reminder is in 15 minutes: ${reminder.title}`,
      sendAt,
      status: "pending",
    };
  })
  .filter((job) => job.sendAt > now);

if (jobs.length > 0) {
  await NotificationJob.insertMany(jobs);
}

return res.status(201).json({
  success: true,
  message: "Reminder created and notifications scheduled",
  reminder,
  scheduledNotifications: jobs.map((job) => ({
    offsetMinutes: job.offsetMinutes,
    sendAt: job.sendAt,
  })),
});

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
      error: error.message,
    });
  }
};

// GET /api/reminders
const getAllReminders = async (req, res) => {
  try {
    const userId = req.user.id;

    await updateMissedReminders(userId);

    const reminders = await Reminder.find({ userId })
      .sort({ date: 1, time: 1 });

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message,
    });
  }
};

// GET /api/reminders/today
const getTodayReminders = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();

    await updateMissedReminders(userId);

    const reminders = await Reminder.find({
      userId,
      date: today,
      status: { $ne: 'missed' },
    }).sort({ time: 1 });

    return res.status(200).json({
      success: true,
      date: today,
      count: reminders.length,
      reminders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's reminders",
      error: error.message,
    });
  }
};

// PATCH /api/reminders/:id/done
const markReminderDone = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID',
      });
    }

    await updateMissedReminders(req.user.id);

    const reminder = await Reminder.findOne({
      _id: id,
      userId: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    if (reminder.status === 'missed') {
      return res.status(400).json({
        success: false,
        message: 'A missed reminder cannot be marked as done',
      });
    }

    if (reminder.status === 'done') {
      return res.status(200).json({
        success: true,
        message: 'Reminder is already completed',
        reminder,
      });
    }

    reminder.status = 'done';
    reminder.completedAt = new Date();

    await reminder.save();

    await NotificationJob.updateMany(
      {
        reminderId: reminder._id,
        status: { $in: ["pending", "processing"] },
      },
      {
        $set: { status: "cancelled" },
      }
    );

    // Remove stored in-app notifications once the reminder is marked done
    await Notification.deleteMany({ reminderId: reminder._id });

    return res.status(200).json({
      success: true,
      message: 'Reminder marked as done',
      reminder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark reminder as done',
      error: error.message,
    });
  }
};

// DELETE /api/reminders/:id
const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reminder ID',
      });
    }

    const reminder = await Reminder.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found',
      });
    }

    await NotificationJob.updateMany(
      {
        reminderId: reminder._id,
        status: { $in: ["pending", "processing"] },
      },
      {
        $set: { status: "cancelled" },
      }
    );

    // Remove stored in-app notifications when reminder is deleted
    await Notification.deleteMany({ reminderId: reminder._id });

    return res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully',
      reminder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: error.message,
    });
  }
};

// GET /api/reminders/history
// Includes completed reminders and reminders missed by date.
const getReminderHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await updateMissedReminders(userId);

    const history = await Reminder.find({
      userId,
      status: { $in: ['done', 'missed'] },
    }).sort({ date: -1, time: -1 });

    return res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder history',
      error: error.message,
    });
  }
};

module.exports = {
  createReminder,
  getAllReminders,
  getTodayReminders,
  markReminderDone,
  deleteReminder,
  getReminderHistory,
  getTodayDate,
  updateMissedReminders,
};
