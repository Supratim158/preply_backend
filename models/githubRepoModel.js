const mongoose = require('mongoose');

const githubRepoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },
    repoId: { type: Number, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    description: { type: String, default: '' },
    repoUrl: { type: String, default: '' },
    languages: {
      type: Map,
      of: Number,
      default: {},
    },
    primaryLanguage: { type: String, default: null },
    topics: { type: [String], default: [] },
    defaultBranch: { type: String, default: 'main' },
    stars: { type: Number, default: 0 },
    forksCount: { type: Number, default: 0 },
    isFork: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    visibility: { type: String, default: 'public' },
    createdAtRepo: { type: Date },
    updatedAtRepo: { type: Date },
    pushedAtRepo: { type: Date },
  },
  { timestamps: true }
);

githubRepoSchema.index({ userId: 1, repoId: 1 }, { unique: true });

module.exports = mongoose.model('GitHubRepo', githubRepoSchema);
