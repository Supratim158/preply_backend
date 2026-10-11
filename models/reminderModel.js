const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Reminder title is required'],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    // YYYY-MM-DD
    date: {
      type: String,
      required: [true, 'Reminder date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },

    // 24-hour format: HH:mm
    time: {
      type: String,
      required: [true, 'Reminder time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm'],
    },

    status: {
      type: String,
      enum: ['pending', 'done', 'missed'],
      default: 'pending',
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

reminderSchema.index({ userId: 1, date: 1, time: 1 });
reminderSchema.index({ userId: 1, status: 1, date: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
