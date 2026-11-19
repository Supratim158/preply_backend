const mongoose = require("mongoose");

const aiResumeSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    originalResume: {
      atsResumeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ATSResume",
      },
      fileUrl: {
        type: String,
      },
      publicId: {
        type: String,
      },
      extractedText: {
        type: String,
      },
      structuredData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      atsScore: {
        type: Number,
        default: 0,
      },
      scoreBreakdown: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      links: [
        {
          url: String,
          domain: String,
          validFormat: Boolean,
          type: { type: String, default: "Other" },
        },
      ],
      pageCount: {
        type: Number,
        default: 1,
      },
    },

    jobDetails: {
      jobRole: {
        type: String,
        required: true,
        trim: true,
      },
      jobDescription: {
        type: String,
        default: "",
        trim: true,
      },
    },

    analysis: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    interview: {
      questions: [
        {
          id: Number,
          question: String,
          category: String,
          topic: String,
          reason: String,
          isFollowUp: { type: Boolean, default: false },
          parentQuestionId: Number,
        },
      ],
      answers: [
        {
          questionId: Number,
          question: String,
          answer: String,
          answeredAt: { type: Date, default: Date.now },
          followUpGenerated: { type: Boolean, default: false },
        },
      ],
      currentQuestionIndex: {
        type: Number,
        default: 0,
      },
      completed: {
        type: Boolean,
        default: false,
      },
      maxQuestions: {
        type: Number,
        default: 8,
      },
    },

    generatedVersions: [
      {
        attemptNumber: Number,
        resumeData: {
          type: mongoose.Schema.Types.Mixed,
        },
        atsScore: Number,
        scoreBreakdown: {
          type: mongoose.Schema.Types.Mixed,
        },
        pdfUrl: String,
        publicId: String,
        pageCount: Number,
        accepted: { type: Boolean, default: false },
        atsAnalysis: {
          type: mongoose.Schema.Types.Mixed,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    bestVersion: {
      type: Number,
      default: null,
    },

    tokenUsage: {
      inputTokens: {
        type: Number,
        default: 0,
      },
      outputTokens: {
        type: Number,
        default: 0,
      },
      totalRequests: {
        type: Number,
        default: 0,
      },
    },

    isGenerating: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "initialized",
        "interviewing",
        "interview_completed",
        "generating",
        "completed",
        "no_improvement",
        "failed",
      ],
      default: "initialized",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AIResumeSession", aiResumeSessionSchema);
