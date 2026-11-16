
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },

  content: {
    type: String,
    required: true,
    maxlength: 30000
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

const chatSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  title: {
    type: String,
    default: 'New Chat',
    maxlength: 100
  },

  messages: {
    type: [messageSchema],
    default: []
  }

}, {
  timestamps: true
});

// Fetch latest conversations first
chatSchema.index({
  userId: 1,
  updatedAt: -1
});

module.exports = mongoose.model('Chat', chatSchema);
