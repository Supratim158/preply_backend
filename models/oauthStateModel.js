const mongoose = require('mongoose');

const oauthStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // Expire after 10 minutes (TTL index)
  },
  { timestamps: true }
);

module.exports = mongoose.model('OAuthState', oauthStateSchema);
