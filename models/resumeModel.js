const mongoose = require("mongoose");

const atsResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    originalName: {
      type: String,
      required: true,
    },

    resumeUrl: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
    },

    targetRole: {
      type: String,
      required: true,
    },

    jobDescription: {
      type: String,
      default: "",
    },

    pageCount: {
      type: Number,
      required: true,
    },

    atsScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    scoreBreakdown: {
      contentScore: Number,
      jobMatchScore: Number,
      linkScore: Number,
      formattingScore: Number,
      pagePenalty: Number,
    },

    links: [
    {
        url: {
            type: String,
            required: true
        },

        domain: {
            type: String,
            default: ""
        },

        validFormat: {
            type: Boolean,
            default: false
        },

        type: {
            type: String,
            default: "Other"
        }
    }
],

    matchedKeywords: [String],

    missingKeywords: [String],

    strengths: [String],

    weaknesses: [String],

    suggestions: [String],

    missingSkills: [String],

    jobMatch: {
      percentage: Number,
      summary: String,
      matchingSkills: [String],
      missingSkills: [String],
    },

    sectionsDetected: [String],

    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ATSResume",
  atsResumeSchema
);