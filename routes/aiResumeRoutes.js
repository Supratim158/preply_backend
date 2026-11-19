const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadResume");
const { verifyTokenAndAuthorization } = require("../middleware/verifyToken");

const {
  startOptimizationSession,
  startInterview,
  getInterviewProgress,
  submitInterviewAnswer,
  generateOptimizedResume,
  getSessionDetails,
  downloadOptimizedPdf,
  deleteSession,
} = require("../controllers/aiResumeController");

// Conditional upload middleware to handle both multipart and JSON bodies seamlessly
const handleOptionalResumeUpload = (req, res, next) => {
  if (req.is("multipart/form-data")) {
    return upload.single("resume")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to process resume upload",
        });
      }
      next();
    });
  }
  next();
};

// 1. Initialize optimization session (reusing existing ATS or uploading new)
router.post(
  "/start",
  verifyTokenAndAuthorization,
  handleOptionalResumeUpload,
  startOptimizationSession
);

// 2. Start interactive interview session
router.post(
  "/interview/start/:sessionId",
  verifyTokenAndAuthorization,
  startInterview
);

// 3. Get current interview question & progress
router.get(
  "/interview/:sessionId",
  verifyTokenAndAuthorization,
  getInterviewProgress
);

// 4. Submit interview answer
router.post(
  "/interview/answer/:sessionId",
  verifyTokenAndAuthorization,
  submitInterviewAnswer
);

// 5. Generate optimized resume & run optimization loop
router.post(
  "/generate/:sessionId",
  verifyTokenAndAuthorization,
  generateOptimizedResume
);

// 6. Get session details & results preview
router.get(
  "/session/:sessionId",
  verifyTokenAndAuthorization,
  getSessionDetails
);

// 7. Download accepted 1-page PDF
router.get(
  "/download/:sessionId",
  verifyTokenAndAuthorization,
  downloadOptimizedPdf
);

// 8. Delete session & associated files
router.delete(
  "/session/:sessionId",
  verifyTokenAndAuthorization,
  deleteSession
);

module.exports = router;
