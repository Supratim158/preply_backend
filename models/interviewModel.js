const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    score: { type: Number, default: 0, min: 0, max: 100 },
    technicalKnowledge: { type: Number, default: 0, min: 0, max: 100 },
    communication: { type: Number, default: 0, min: 0, max: 100 },
    problemSolving: { type: Number, default: 0, min: 0, max: 100 },
    behavioral: { type: Number, default: 0, min: 0, max: 100 },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    relevance: { type: Number, default: 0, min: 0, max: 100 },
    grammar: { type: Number, default: 0, min: 0, max: 100 },

    feedback: { type: String, default: "" },

    strengths: [String],
    weaknesses: [String],
    suggestions: [String],
    missingPoints: [String],
    importantKeywordsHeard: [String],

    fillerFeedback: { type: String, default: "" },
    pauseFeedback: { type: String, default: "" }
  },
  { _id: false }
);

const speechSchema = new mongoose.Schema(
  {
    audioDurationSeconds: { type: Number, default: 0 },
    speakingDurationSeconds: { type: Number, default: 0 },
    speakingRateWpm: { type: Number, default: 0 },
    wordCount: { type: Number, default: 0 },

    fillerWordCount: { type: Number, default: 0 },
    fillerWords: [String],

    pauseCount: { type: Number, default: 0 },
    totalPauseSeconds: { type: Number, default: 0 },
    longestPauseSeconds: { type: Number, default: 0 },

    pauses: [{
      start: Number,
      end: Number,
      durationSeconds: Number
    }],

    // Store word-level or segment-level timing for transcript review.
    segments: [{
      start: Number,
      end: Number,
      text: String
    }]
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, required: true },
    question: { type: String, required: true },

    category: {
      type: String,
      enum: [
        "Technical",
        "Communication",
        "Problem Solving",
        "Behavioral / HR"
      ],
      required: true
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium"
    },

    expectedKeywords: [String],

    timeLimitSeconds: {
      type: Number,
      required: true,
      min: 15,
      max: 45
    },

    startedAt: Date,
    deadline: Date,
    answeredAt: Date,

    answer: { type: String, default: "" },
    transcript: { type: String, default: "" },

    speechMetrics: {
      type: speechSchema,
      default: () => ({})
    },

    timedOut: { type: Boolean, default: false },
    processing: { type: Boolean, default: false },

    evaluation: {
      type: evaluationSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

const categoryScoreSchema = new mongoose.Schema(
  {
    score: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },
    weightedPoints: { type: Number, default: 0 }
  },
  { _id: false }
);

const finalReportSchema = new mongoose.Schema(
  {
    overallScore: { type: Number, default: 0 },

    categories: {
      technical: {
        type: categoryScoreSchema,
        default: () => ({})
      },
      communication: {
        type: categoryScoreSchema,
        default: () => ({})
      },
      problemSolving: {
        type: categoryScoreSchema,
        default: () => ({})
      },
      behavioral: {
        type: categoryScoreSchema,
        default: () => ({})
      }
    },

    skillWisePerformance: {
      technical: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      problemSolving: { type: Number, default: 0 },
      behavioral: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 }
    },

    speechAnalysis: {
      totalFillerWords: { type: Number, default: 0 },
      totalPauses: { type: Number, default: 0 },
      totalPauseSeconds: { type: Number, default: 0 },
      averageSpeakingRateWpm: { type: Number, default: 0 }
    },

    performanceLabel: { type: String, default: "" },
    summary: { type: String, default: "" },

    strengths: [String],
    weaknesses: [String],
    suggestions: [String],

    totalQuestions: { type: Number, default: 10 },
    answeredQuestions: { type: Number, default: 0 },
    timedOutQuestions: { type: Number, default: 0 },

    completedAt: Date
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    originalName: String,
    resumeUrl: String,
    resumePublicId: String,

    resumeText: {
      type: String,
      select: false
    },

    resumeContext: {
      type: String,
      default: ""
    },

    targetRole: {
      type: String,
      required: true
    },

    jobDescription: {
      type: String,
      default: ""
    },

    experienceLevel: {
      type: String,
      enum: ["freshie", "intermediate", "senior"],
      required: true
    },

    totalQuestions: { type: Number, default: 10 },
    currentQuestionNumber: { type: Number, default: 1 },

    status: {
      type: String,
      enum: ["in_progress", "completed", "cancelled"],
      default: "in_progress",
      index: true
    },

    questions: [questionSchema],

    finalReport: {
      type: finalReportSchema,
      default: () => ({})
    },

    startedAt: { type: Date, default: Date.now },
    completedAt: Date
  },
  { timestamps: true }
);

interviewSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Interview", interviewSchema);