const mongoose = require('mongoose');

const domainBreakdownItemSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true },
    score: { type: Number, required: true },
    repositoryCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const githubInsightsSchema = new mongoose.Schema(
  {
    recommendedDomain: { type: String, default: 'Insufficient Data' },
    confidence: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
    totalRepositories: { type: Number, default: 0 },
    analyzedRepositories: { type: Number, default: 0 },
    domainBreakdown: [domainBreakdownItemSchema],
    reason: { type: String, default: '' },
    lastAnalyzedAt: { type: Date, default: null },
  },
  { _id: false }
);

const githubAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      unique: true,
      index: true,
    },
    githubId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: { type: String, required: true },
    profileUrl: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    accessToken: { type: String, required: true }, // AES-256-GCM encrypted
    scopes: { type: [String], default: ['read:user', 'public_repo'] },
    status: {
      type: String,
      enum: ['connected', 'disconnected'],
      default: 'connected',
    },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    insights: { type: githubInsightsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GitHubAccount', githubAccountSchema);
