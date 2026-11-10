const express = require("express");
const router = express.Router();

const {
  verifyTokenAndAuthorization
} = require("../middleware/verifyToken");

const {
  resumeUpload,
  audioUpload
} = require("../middleware/interviewUpload");

const {
  startInterview,
  submitAnswer,
  getCurrentQuestion,
  getInterviewResult,
  getInterviewHistory,
  getInterviewInsights,
  cancelInterview
} = require("../controllers/interviewController");

// Start interview
router.post(
  "/start",
  verifyTokenAndAuthorization,
  resumeUpload.single("resume"),
  startInterview
);

// Submit recorded answer
router.post(
  "/:interviewId/answer",
  verifyTokenAndAuthorization,
  audioUpload.single("audio"),
  submitAnswer
);

// Get current question and remaining timer
router.get(
  "/:interviewId/current",
  verifyTokenAndAuthorization,
  getCurrentQuestion
);

// Get completed interview analysis
router.get(
  "/:interviewId/result",
  verifyTokenAndAuthorization,
  getInterviewResult
);

// Get AI career insights based on interview history
router.get(
  "/insights",
  verifyTokenAndAuthorization,
  getInterviewInsights
);

router.get(
  "/ai-insight",
  verifyTokenAndAuthorization,
  getInterviewInsights
);

// Get interview history
router.get(
  "/history",
  verifyTokenAndAuthorization,
  getInterviewHistory
);

// Cancel interview
router.post(
  "/:interviewId/cancel",
  verifyTokenAndAuthorization,
  cancelInterview
);

module.exports = router;