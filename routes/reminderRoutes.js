
const express = require('express');
const router = express.Router();

const {
  createReminder,
  getAllReminders,
  getTodayReminders,
  markReminderDone,
  deleteReminder,
  getReminderHistory,
} = require('../controllers/reminderController');

const {
  verifyTokenAndAuthorization,
} = require('../middleware/verifyToken');

// Create a reminder
router.post('/', verifyTokenAndAuthorization, createReminder);

// Get today's reminders
router.get('/today', verifyTokenAndAuthorization, getTodayReminders);

// Get completed and missed reminders
router.get('/history', verifyTokenAndAuthorization, getReminderHistory);

// Mark a reminder as done
router.patch('/:id/done', verifyTokenAndAuthorization, markReminderDone);

// Delete a reminder
router.delete('/:id', verifyTokenAndAuthorization, deleteReminder);

// Get all reminders
router.get('/', verifyTokenAndAuthorization, getAllReminders);

module.exports = router;
