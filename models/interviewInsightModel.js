const mongoose = require("mongoose");

const roleBreakdownSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    count: { type: Number, default: 0 },
    firstScore: { type: Number, default: 0 },
    latestScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    percentageChange: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["baseline", "improved", "declined", "steady"],
      default: "baseline"
    },
    feedback: { type: String, default: "" }
  },
  { _id: false }
);

const interviewInsightSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true
    },
    hasInterviews: { type: Boolean, default: false },
    totalInterviews: { type: Number, default: 0 },
    overallAverageScore: { type: Number, default: 0 },
    overallPercentageChange: { type: Number, default: 0 },

    insight: { type: String, default: "" },
    summary: { type: String, default: "" },

    roleBreakdown: [roleBreakdownSchema],

    keyStrengths: [String],
    focusAreas: [String],
    recommendations: [String],

    lastInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview"
    },
    lastCalculatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InterviewInsight", interviewInsightSchema);

