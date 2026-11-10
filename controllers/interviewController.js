const mongoose = require("mongoose");
const Groq = require("groq-sdk");

const Interview = require("../models/interviewModel");
const cloudinary = require("../config/cloudinary");

const { extractResumeText } = require("../utils/interviewResumeParser");
const { analyzeSpeech } = require("../utils/speechAnalyzer");

const {
  createCombinedEvaluation,
  getFirstQuestion,
  getFinalQuestion,
  QUESTION_CATEGORIES
} = require("../utils/interviewAI");

const {
  calculateInterviewStats,
  generateInterviewAIInsight,
  refreshUserInterviewInsight
} = require("../utils/interviewInsightAI");
const InterviewInsight = require("../models/interviewInsightModel");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const getUserId = (req) =>
  req.user?._id || req.user?.id || req.user?.userId;

const clamp = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const timerGraceSeconds = Number(
  process.env.INTERVIEW_TIMER_GRACE_SECONDS || 3
);

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "preply/interviews/resumes",
        public_id: `resume_${Date.now()}`,
        resource_type: "raw"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });

// Groq transcription. No audio is saved in MongoDB.
const transcribeAudio = async (file, resumeContext) => {
  const audioFile = new File(
    [file.buffer],
    file.originalname || "interview-answer.webm",
    { type: file.mimetype }
  );

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,

    model:
      process.env.GROQ_WHISPER_MODEL || "whisper-large-v3",

    language: process.env.GROQ_LANGUAGE || "en",

    response_format: "verbose_json",

    // Word timestamps help calculate pauses.
    timestamp_granularities: ["word"],

    temperature: 0,

    // Ask for verbatim transcription. This is guidance, not a guarantee.
    prompt: `
Transcribe the candidate's speech verbatim.
Preserve spoken hesitation and filler sounds such as:
um, uh, hmm, hm, ah, er, and repeated words.
Do not rewrite, summarize, correct grammar, or remove repetitions.
Technical context: ${resumeContext.slice(0, 400)}
`
  });

  return analyzeSpeech(transcription);
};

const createQuestionDocument = (data, questionNumber) => {
  const now = new Date();

  const seconds = Math.max(
    15,
    Math.min(45, Number(data.timeLimitSeconds) || 30)
  );

  return {
    questionNumber,
    question: data.question,
    category: data.category,
    difficulty: data.difficulty || "medium",
    expectedKeywords: data.expectedKeywords || [],

    timeLimitSeconds: seconds,

    startedAt: now,
    deadline: new Date(now.getTime() + seconds * 1000),

    processing: false
  };
};

const createPreviousContext = (questions) => {
  return questions
    .filter((q) => q.answer)
    .slice(-4)
    .map((q) => `
Q${q.questionNumber}: ${q.question}
Answer: ${q.answer.slice(0, 300)}
Feedback: ${q.evaluation?.feedback?.slice(0, 120) || ""}
`)
    .join("\n")
    .slice(0, 2000);
};

const calculateFinalScores = (questions) => {
  const configs = [
    { key: "technical", name: "Technical", weight: 40 },
    { key: "communication", name: "Communication", weight: 25 },
    { key: "problemSolving", name: "Problem Solving", weight: 20 },
    { key: "behavioral", name: "Behavioral / HR", weight: 15 }
  ];

  const categories = {};
  let overallScore = 0;

  for (const config of configs) {
    const matching = questions.filter(
      (q) => q.category === config.name
    );

    const average = matching.length
      ? matching.reduce(
          (sum, q) => sum + clamp(q.evaluation?.score),
          0
        ) / matching.length
      : 0;

    const score = Math.round(average);
    const weightedPoints = Number(
      (score * config.weight / 100).toFixed(2)
    );

    categories[config.key] = {
      score,
      weight: config.weight,
      weightedPoints
    };

    overallScore += weightedPoints;
  }

  const averageMetric = (field) => {
    if (!questions.length) return 0;

    return Math.round(
      questions.reduce(
        (sum, q) => sum + clamp(q.evaluation?.[field]),
        0
      ) / questions.length
    );
  };

  const totalFillers = questions.reduce(
    (sum, q) => sum + (q.speechMetrics?.fillerWordCount || 0),
    0
  );

  const totalPauses = questions.reduce(
    (sum, q) => sum + (q.speechMetrics?.pauseCount || 0),
    0
  );

  const totalPauseSeconds = questions.reduce(
    (sum, q) => sum + (q.speechMetrics?.totalPauseSeconds || 0),
    0
  );

  const speechQuestions = questions.filter(
    (q) => q.speechMetrics?.audioDurationSeconds > 0
  );

  const averageSpeakingRate = speechQuestions.length
    ? Math.round(
        speechQuestions.reduce(
          (sum, q) => sum + (q.speechMetrics?.speakingRateWpm || 0),
          0
        ) / speechQuestions.length
      )
    : 0;

  return {
    overallScore: Math.round(overallScore),

    categories,

    skillWisePerformance: {
      technical: categories.technical.score,
      communication: categories.communication.score,
      problemSolving: categories.problemSolving.score,
      behavioral: categories.behavioral.score,
      confidence: averageMetric("confidence")
    },

    speechAnalysis: {
      totalFillerWords: totalFillers,
      totalPauses,
      totalPauseSeconds: Number(totalPauseSeconds.toFixed(2)),
      averageSpeakingRateWpm: averageSpeakingRate
    }
  };
};

const getPerformanceLabel = (score) => {
  if (score >= 90) return "Excellent Performance!";
  if (score >= 80) return "Great Performance!";
  if (score >= 70) return "Good Performance!";
  if (score >= 60) return "Average Performance";
  return "Needs Improvement";
};

// POST /api/interview/start
exports.startInterview = async (req, res) => {
  let uploadedPublicId;

  try {
    const userId = getUserId(req);

    const {
      targetRole,
      jobDescription = "",
      experienceLevel
    } = req.body;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        status: false,
        message: "Valid authentication is required."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Please upload your resume PDF."
      });
    }

    if (!targetRole?.trim()) {
      return res.status(400).json({
        status: false,
        message: "Target job role is required."
      });
    }

    if (!["freshie", "intermediate", "senior"].includes(experienceLevel)) {
      return res.status(400).json({
        status: false,
        message: "Invalid experience level."
      });
    }

    // Parse the resume once.
    const parsed = await extractResumeText(req.file.buffer);

    // Upload PDF to Cloudinary.
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer);
    uploadedPublicId = cloudinaryResult.public_id;

    const firstQuestion = createQuestionDocument(
      getFirstQuestion(),
      1
    );

    const interview = await Interview.create({
      userId,

      originalName: req.file.originalname,
      resumeUrl: cloudinaryResult.secure_url,
      resumePublicId: cloudinaryResult.public_id,

      resumeText: parsed.text,
      resumeContext: parsed.text.slice(0, 2500),

      targetRole: targetRole.trim(),
      jobDescription: String(jobDescription).slice(0, 3000),
      experienceLevel,

      totalQuestions: 10,
      currentQuestionNumber: 1,
      status: "in_progress",

      startedAt: new Date(),
      questions: [firstQuestion]
    });

    return res.status(201).json({
      status: true,
      message: "Interview started successfully.",

      data: {
        interviewId: interview._id,
        targetRole,
        experienceLevel,
        totalQuestions: 10,

        currentQuestion: {
          questionNumber: 1,
          question: firstQuestion.question,
          category: firstQuestion.category,
          timeLimitSeconds: firstQuestion.timeLimitSeconds,
          startedAt: firstQuestion.startedAt,
          deadline: firstQuestion.deadline
        }
      }
    });
  } catch (error) {
    console.error("Start interview:", error);

    if (uploadedPublicId) {
      await cloudinary.uploader.destroy(uploadedPublicId, {
        resource_type: "raw"
      }).catch(() => {});
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Unable to start interview."
    });
  }
};

// POST /api/interview/:interviewId/answer
exports.submitAnswer = async (req, res) => {
  const userId = getUserId(req);
  const interviewId = req.params.interviewId;

  let lockedQuestionNumber = null;

  try {
    if (!userId || !mongoose.isValidObjectId(interviewId)) {
      return res.status(401).json({
        status: false,
        message: "Invalid authentication or interview ID."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Please upload the recorded answer."
      });
    }

    const interview = await Interview.findOne({
      _id: interviewId,
      userId,
      status: "in_progress"
    });

    if (!interview) {
      return res.status(404).json({
        status: false,
        message: "Active interview not found."
      });
    }

    const questionNumber = interview.currentQuestionNumber;
    lockedQuestionNumber = questionNumber;

    const question = interview.questions.find(
      (q) => q.questionNumber === questionNumber
    );

    if (!question || question.answeredAt) {
      return res.status(409).json({
        status: false,
        message: "Question already answered or unavailable."
      });
    }

    // Acquire a lock so two submissions cannot evaluate the same question.
    const lock = await Interview.updateOne(
      {
        _id: interviewId,
        userId,
        status: "in_progress",
        currentQuestionNumber: questionNumber,
        questions: {
          $elemMatch: {
            questionNumber,
            answeredAt: null,
            processing: false
          }
        }
      },
      {
        $set: {
          "questions.$.processing": true
        }
      }
    );

    if (!lock.modifiedCount) {
      return res.status(409).json({
        status: false,
        message: "This answer is already being processed."
      });
    }

    // Transcribe the audio with Groq.
    const speechMetrics = await transcribeAudio(
      req.file,
      interview.resumeContext
    );

    const answer = speechMetrics.transcript;

    const recordingStartedAt = new Date(
  req.body.recordingStartedAt
);

const recordingEndedAt = new Date(
  req.body.recordingEndedAt
);

const validRecordingTimes =
  !Number.isNaN(recordingStartedAt.getTime()) &&
  !Number.isNaN(recordingEndedAt.getTime());

const deadline = new Date(question.deadline).getTime();

const timedOut =
  !validRecordingTimes ||
  recordingStartedAt.getTime() > deadline ||
  recordingEndedAt.getTime() > deadline + 3000 ||
  recordingEndedAt.getTime() < recordingStartedAt.getTime();

    const previousContext = createPreviousContext(
      interview.questions
    );

    const isLastQuestion = questionNumber === 10;

    // One combined AI call.
    const aiResult = await createCombinedEvaluation({
      interview,
      question,
      answer,
      speechMetrics,
      previousContext,
      isLastQuestion,
      timedOut
    });

    const evaluation = aiResult.evaluation;

    // Reload the latest document after AI processing.
    const latest = await Interview.findOne({
      _id: interviewId,
      userId,
      status: "in_progress",
      currentQuestionNumber: questionNumber
    });

    if (!latest) {
      throw new Error("Interview state changed during processing.");
    }

    const latestQuestion = latest.questions.find(
      (q) => q.questionNumber === questionNumber
    );

    if (!latestQuestion || !latestQuestion.processing) {
      throw new Error("Question processing lock was lost.");
    }

    // Store complete answer and speech analysis.
    latestQuestion.answer = answer;
    latestQuestion.transcript = answer;
    latestQuestion.answeredAt = new Date();
    latestQuestion.timedOut = timedOut;
    latestQuestion.processing = false;

    latestQuestion.speechMetrics = {
      audioDurationSeconds: speechMetrics.audioDurationSeconds,
      speakingDurationSeconds: speechMetrics.speakingDurationSeconds,
      speakingRateWpm: speechMetrics.speakingRateWpm,
      wordCount: speechMetrics.wordCount,

      fillerWordCount: speechMetrics.fillerWordCount,
      fillerWords: speechMetrics.fillerWords,

      pauseCount: speechMetrics.pauseCount,
      totalPauseSeconds: speechMetrics.totalPauseSeconds,
      longestPauseSeconds: speechMetrics.longestPauseSeconds,

      pauses: speechMetrics.pauses,

      // Keep transcript timing data, not the audio binary.
      segments: speechMetrics.segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        text: segment.text
      }))
    };

    latestQuestion.evaluation = evaluation;

    let nextQuestion = null;
    let finalReport = null;

    if (!isLastQuestion) {
      const nextNumber = questionNumber + 1;

      // Keep question 10 fixed.
      const generated = nextNumber === 10
        ? getFinalQuestion()
        : aiResult.nextQuestion;

      // The backend controls the category sequence.
      generated.category = QUESTION_CATEGORIES[nextNumber];

      nextQuestion = createQuestionDocument(
        generated,
        nextNumber
      );

      latest.questions.push(nextQuestion);
      latest.currentQuestionNumber = nextNumber;
    } else {
      const calculated = calculateFinalScores(
        latest.questions
      );

      const report = aiResult.finalReport || {};

      finalReport = {
        ...calculated,

        performanceLabel: getPerformanceLabel(
          calculated.overallScore
        ),

        summary: report.summary || "",

        strengths: report.strengths || [],
        weaknesses: report.weaknesses || [],
        suggestions: report.suggestions || [],

        totalQuestions: 10,

        answeredQuestions: latest.questions.filter(
          (q) => q.answeredAt
        ).length,

        timedOutQuestions: latest.questions.filter(
          (q) => q.timedOut
        ).length,

        completedAt: new Date()
      };

      latest.finalReport = finalReport;
      latest.status = "completed";
      latest.completedAt = new Date();
    }

    await latest.save();

    // Automatically recalculate and update the AI insight after every completed interview
    let updatedInsight = null;
    if (latest.status === "completed") {
      try {
        updatedInsight = await refreshUserInterviewInsight(
          latest.userId,
          latest._id
        );
      } catch (insightErr) {
        console.error(
          "Auto-refreshing interview insight on completion failed:",
          insightErr
        );
      }
    }

    return res.status(200).json({
      status: true,

      message: nextQuestion
        ? "Answer transcribed and evaluated successfully."
        : "Interview completed successfully.",

      data: {
        interviewId,
        ...(updatedInsight ? { updatedInsight } : {}),

        submittedQuestion: {
          questionNumber,
          transcript: answer,
          timedOut,

          speechMetrics: {
            wordCount: speechMetrics.wordCount,
            audioDurationSeconds: speechMetrics.audioDurationSeconds,
            speakingRateWpm: speechMetrics.speakingRateWpm,
            fillerWordCount: speechMetrics.fillerWordCount,
            fillerWords: speechMetrics.fillerWords,
            pauseCount: speechMetrics.pauseCount,
            totalPauseSeconds: speechMetrics.totalPauseSeconds,
            longestPauseSeconds: speechMetrics.longestPauseSeconds
          },

          evaluation
        },

        nextQuestion: nextQuestion
          ? {
              questionNumber: nextQuestion.questionNumber,
              question: nextQuestion.question,
              category: nextQuestion.category,
              difficulty: nextQuestion.difficulty,
              expectedKeywords: nextQuestion.expectedKeywords,
              timeLimitSeconds: nextQuestion.timeLimitSeconds,
              startedAt: nextQuestion.startedAt,
              deadline: nextQuestion.deadline
            }
          : null,

        completed: !nextQuestion,
        finalReport
      }
    });
  } catch (error) {
    console.error("Submit interview answer:", error);

    // Release the lock if transcription or AI processing fails.
    if (lockedQuestionNumber !== null) {
      await Interview.updateOne(
        {
          _id: interviewId,
          userId,
          "questions.questionNumber": lockedQuestionNumber,
          "questions.processing": true,
          "questions.answeredAt": null
        },
        {
          $set: {
            "questions.$.processing": false
          }
        }
      ).catch(() => {});
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Unable to process interview answer."
    });
  }
};

// GET /api/interview/:interviewId/current
exports.getCurrentQuestion = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.interviewId,
      userId: getUserId(req),
      status: "in_progress"
    });

    if (!interview) {
      return res.status(404).json({
        status: false,
        message: "Active interview not found."
      });
    }

    const question = interview.questions.find(
      (q) => q.questionNumber === interview.currentQuestionNumber
    );

    if (!question) {
      return res.status(404).json({
        status: false,
        message: "Current question not found."
      });
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        (new Date(question.deadline).getTime() - Date.now()) / 1000
      )
    );

    return res.status(200).json({
      status: true,
      data: {
        interviewId: interview._id,

        currentQuestion: {
          questionNumber: question.questionNumber,
          question: question.question,
          category: question.category,
          difficulty: question.difficulty,
          timeLimitSeconds: question.timeLimitSeconds,
          startedAt: question.startedAt,
          deadline: question.deadline,
          remainingSeconds
        }
      }
    });
  } catch (error) {
    console.error("Get current question:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to get current question."
    });
  }
};

// GET /api/interview/:interviewId/result
exports.getInterviewResult = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.interviewId,
      userId: getUserId(req)
    }).select("-resumeText");

    if (!interview) {
      return res.status(404).json({
        status: false,
        message: "Interview not found."
      });
    }

    if (interview.status !== "completed") {
      return res.status(400).json({
        status: false,
        message: "Interview is not completed yet."
      });
    }

    return res.status(200).json({
      status: true,
      data: interview
    });
  } catch (error) {
    console.error("Get interview result:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to get interview result."
    });
  }
};

// GET /api/interview/history
exports.getInterviewHistory = async (req, res) => {
  try {
    const interviews = await Interview.find({
      userId: getUserId(req)
    })
      .select(
        "targetRole experienceLevel status finalReport startedAt completedAt createdAt"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      count: interviews.length,
      data: interviews
    });
  } catch (error) {
    console.error("Interview history:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to get interview history."
    });
  }
};

// POST /api/interview/:interviewId/cancel
exports.cancelInterview = async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      {
        _id: req.params.interviewId,
        userId: getUserId(req),
        status: "in_progress"
      },
      {
        $set: { status: "cancelled" }
      },
      { returnDocument: "after" }
    );

    if (!interview) {
      return res.status(404).json({
        status: false,
        message: "Active interview not found."
      });
    }

    return res.status(200).json({
      status: true,
      message: "Interview cancelled successfully."
    });
  } catch (error) {
    console.error("Cancel interview:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to cancel interview."
    });
  }
};

// GET /api/interview/insights
exports.getInterviewInsights = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "User authentication required."
      });
    }

    const forceRefresh = req.query.refresh === "true";

    // Find latest completed interview
    const latestCompleted = await Interview.findOne({
      userId,
      status: "completed"
    })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();

    // Check if we have an existing calculated insight
    const existingInsight = await InterviewInsight.findOne({ userId }).lean();

    // If an insight already exists and matches the latest completed interview (and no force refresh), return it
    const isUpToDate =
      existingInsight &&
      ((!latestCompleted && !existingInsight.hasInterviews) ||
        (latestCompleted &&
          existingInsight.lastInterviewId &&
          String(existingInsight.lastInterviewId) ===
            String(latestCompleted._id)));

    if (isUpToDate && !forceRefresh) {
      return res.status(200).json({
        status: true,
        data: existingInsight
      });
    }

    // Otherwise recalculate and persist the updated insight
    const updated = await refreshUserInterviewInsight(
      userId,
      latestCompleted?._id || null
    );

    return res.status(200).json({
      status: true,
      data: updated
    });
  } catch (error) {
    console.error("Get interview insights:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to generate interview insights."
    });
  }
};