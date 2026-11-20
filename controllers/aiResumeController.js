const mongoose = require("mongoose");
const axios = require("axios");
const AIResumeSession = require("../models/AIResumeSession");
const ATSResume = require("../models/resumeModel");
const parseResume = require("../utils/resumeParser");
const { analyzeResumeForOptimization } = require("../services/aiResumeAnalyzer");
const {
  initializeInterview,
  getInterviewStatus,
  processAnswer,
} = require("../services/aiInterviewService");
const {
  runResumeOptimizationLoop,
  uploadPdfToCloudinary,
} = require("../services/aiResumeOptimizer");
const {
  evaluateResumeATS,
  analyzeLinks,
} = require("../services/atsScoringService");
const { generateOnePageResumePdf } = require("../services/resumePdfGenerator");
const cloudinary = require("../config/cloudinary");

/**
 * Extract authenticated user ObjectId
 */
const getAuthenticatedUserId = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  return new mongoose.Types.ObjectId(userId);
};

// ============================================
// 1. START / INITIALIZE OPTIMIZATION SESSION
// ============================================
exports.startOptimizationSession = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const {
      atsResumeId,
      targetRole: bodyTargetRole,
      jobRole: bodyJobRole,
      jobDescription = "",
    } = req.body;

    let targetRole = (bodyJobRole || bodyTargetRole || "").trim();
    let originalText = "";
    let originalAtsScore = 0;
    let originalScoreBreakdown = {};
    let originalLinks = [];
    let originalFileUrl = "";
    let originalPublicId = "";
    let pageCount = 1;
    let originalStructuredData = {};

    // --------------------------------------------
    // Case A: Reusing existing ATS analysis record
    // --------------------------------------------
    if (atsResumeId) {
      if (!mongoose.Types.ObjectId.isValid(atsResumeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ATS resume reference ID",
        });
      }

      const existingATS = await ATSResume.findOne({
        _id: atsResumeId,
        userId,
      });

      if (!existingATS) {
        return res.status(404).json({
          success: false,
          message: "Referenced ATS resume record not found or unauthorized",
        });
      }

      targetRole = targetRole || existingATS.targetRole;
      originalAtsScore = existingATS.atsScore || 0;
      originalScoreBreakdown = existingATS.scoreBreakdown || {};
      originalLinks = existingATS.links || [];
      originalFileUrl = existingATS.resumeUrl;
      originalPublicId = existingATS.publicId;
      pageCount = existingATS.pageCount || 1;

      // Download buffer to parse text if not already available
      if (existingATS.resumeUrl) {
        try {
          const fileResp = await axios.get(existingATS.resumeUrl, {
            responseType: "arraybuffer",
            timeout: 15000,
          });
          const parsed = await parseResume(Buffer.from(fileResp.data));
          originalText = parsed.text;
          pageCount = parsed.pageCount;
          if (!originalLinks || originalLinks.length === 0) {
            originalLinks = analyzeLinks(parsed.links || []);
          }
        } catch (fetchErr) {
          console.warn("Could not fetch remote resume PDF:", fetchErr.message);
        }
      }

      originalStructuredData = {
        matchedKeywords: existingATS.matchedKeywords,
        missingKeywords: existingATS.missingKeywords,
        strengths: existingATS.strengths,
        weaknesses: existingATS.weaknesses,
        suggestions: existingATS.suggestions,
        jobMatch: existingATS.jobMatch,
      };
    }
    // --------------------------------------------
    // Case B: Uploading resume file directly
    // --------------------------------------------
    else if (req.file) {
      if (
        req.file.mimetype !== "application/pdf" ||
        !req.file.originalname.toLowerCase().endsWith(".pdf")
      ) {
        return res.status(400).json({
          success: false,
          message: "Only PDF resumes are supported",
        });
      }

      const parsed = await parseResume(req.file.buffer);
      originalText = parsed.text;
      pageCount = parsed.pageCount;
      originalLinks = analyzeLinks(parsed.links || []);

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          message: "Target job role is required",
        });
      }

      // Run existing ATS scoring on the original resume
      const atsEvaluation = await evaluateResumeATS({
        parsedData: parsed,
        targetRole,
        jobDescription,
      });

      originalAtsScore = atsEvaluation.atsScore;
      originalScoreBreakdown = atsEvaluation.scoreBreakdown;
      originalStructuredData = atsEvaluation.ai;

      // Upload original to Cloudinary
      const cloudUpload = await uploadPdfToCloudinary(
        req.file.buffer,
        req.file.originalname
      );
      originalFileUrl = cloudUpload.secure_url;
      originalPublicId = cloudUpload.public_id;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide either an atsResumeId or upload a resume PDF file",
      });
    }

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: "Target job role is required",
      });
    }

    if (!originalText || originalText.trim().length < 40) {
      return res.status(400).json({
        success: false,
        message: "Unable to extract readable text from the provided resume PDF",
      });
    }

    // --------------------------------------------
    // STEP: Perform AI Resume Analysis
    // --------------------------------------------
    const { analysis, usage } = await analyzeResumeForOptimization({
      resumeText: originalText,
      targetRole,
      jobDescription,
      links: originalLinks,
    });

    // Create session in database
    const session = await AIResumeSession.create({
      userId,
      originalResume: {
        atsResumeId: atsResumeId || null,
        fileUrl: originalFileUrl,
        publicId: originalPublicId,
        extractedText: originalText,
        structuredData: originalStructuredData,
        atsScore: originalAtsScore,
        scoreBreakdown: originalScoreBreakdown,
        links: originalLinks,
        pageCount,
      },
      jobDetails: {
        jobRole: targetRole,
        jobDescription: jobDescription.trim(),
      },
      analysis,
      interview: {
        questions: [],
        answers: [],
        currentQuestionIndex: 0,
        completed: false,
        maxQuestions: 8,
      },
      generatedVersions: [],
      bestVersion: null,
      tokenUsage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalRequests: 1,
      },
      status: "initialized",
    });

    return res.status(201).json({
      success: true,
      message: "Resume optimization session initialized successfully",
      data: {
        sessionId: session._id,
        jobRole: targetRole,
        originalATSScore: originalAtsScore,
        scoreBreakdown: originalScoreBreakdown,
        analysis,
        status: session.status,
      },
    });
  } catch (error) {
    console.error("Start Optimization Session Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize resume optimization session",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 2. START INTERVIEW SESSION
// ============================================
exports.startInterview = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    const interviewData = await initializeInterview(session);

    return res.status(200).json({
      success: true,
      message: "Personalized interview initialized successfully",
      data: interviewData,
    });
  } catch (error) {
    console.error("Start Interview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start interview session",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 3. GET CURRENT INTERVIEW QUESTION & PROGRESS
// ============================================
exports.getInterviewProgress = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    const status = getInterviewStatus(session);

    return res.status(200).json({
      success: true,
      message: "Interview progress fetched successfully",
      data: status,
    });
  } catch (error) {
    console.error("Get Interview Progress Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve interview progress",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 4. SUBMIT INTERVIEW ANSWER
// ============================================
exports.submitInterviewAnswer = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    const { answer, questionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    if (answer === undefined || answer === null || String(answer).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Answer cannot be empty",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    const result = await processAnswer(session, {
      answer: String(answer).trim(),
      questionId,
    });

    return res.status(200).json({
      success: true,
      message: result.isCompleted
        ? "Interview completed! Ready to generate optimized resume."
        : "Answer submitted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Submit Interview Answer Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit interview answer",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 5. GENERATE OPTIMIZED RESUME & RUN OPTIMIZATION LOOP
// ============================================
exports.generateOptimizedResume = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    if (session.isGenerating) {
      return res.status(409).json({
        success: false,
        message: "Optimization generation is already currently in progress",
      });
    }

    // Run the complete optimization loop
    const result = await runResumeOptimizationLoop(session, req.user || {});

    // Format response matching Section 14 and Section 17 specifications
    if (result.optimization.improved) {
      return res.status(200).json({
        success: true,
        message: "Optimized resume generated successfully",
        data: {
          sessionId: result.sessionId,
          status: result.status,
          jobRole: result.jobRole,
          originalScore: result.originalScore,
          optimizedScore: result.optimizedScore,
          originalATSScore: result.originalScore,
          optimizedATSScore: result.optimizedScore,
          atsComparison: result.atsComparison,
          optimization: result.optimization,
          resume: result.resume,
          pdf: result.pdf,
          pdfInfo: result.pdf,
        },
        pdf: result.pdf,
        pdfInfo: result.pdf,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "No better resume version was found. Original resume preserved.",
        data: {
          sessionId: result.sessionId,
          status: "no_improvement",
          jobRole: result.jobRole,
          originalATSScore: result.atsComparison.originalScore,
          bestOptimizedScore: result.atsComparison.optimizedScore,
          improved: false,
          downloadUrl: null,
          attempts: result.optimization.attempts,
        },
      });
    }
  } catch (error) {
    console.error("Generate Optimized Resume Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate optimized resume",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 6. GET SESSION DETAILS & FINAL RESULTS PREVIEW
// ============================================
exports.getSessionDetails = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    }).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    const originalScore = session.originalResume?.atsScore || 0;
    const acceptedVersion = (session.generatedVersions || []).find((v) => v.accepted) || null;
    const isImproved = Boolean(acceptedVersion && acceptedVersion.atsScore > originalScore);

    const responseData = {
      sessionId: session._id,
      status: session.status,
      jobRole: session.jobDetails.jobRole,
      jobDescription: session.jobDetails.jobDescription,
      atsComparison: {
        originalScore,
        optimizedScore: isImproved ? acceptedVersion.atsScore : originalScore,
        improvement: isImproved ? acceptedVersion.atsScore - originalScore : 0,
      },
      optimization: {
        attempts: (session.generatedVersions || []).length,
        improved: isImproved,
        bestVersion: session.bestVersion,
      },
      resume: isImproved ? acceptedVersion.resumeData : null,
      pdf: isImproved
        ? {
            downloadUrl: `/api/ai-resume/download/${session._id}`,
            fileName: `${(acceptedVersion.resumeData?.personalDetails?.fullName || "Candidate").replace(/\s+/g, "_")}_${session.jobDetails.jobRole.replace(/\s+/g, "_")}_Resume.pdf`,
            pageCount: acceptedVersion.pageCount || 1,
            pageSize: "A4",
            isValid: (acceptedVersion.pageCount || 1) === 1,
            cloudUrl: acceptedVersion.pdfUrl,
          }
        : null,
      interviewSummary: {
        totalQuestions: (session.interview?.questions || []).length,
        answeredCount: (session.interview?.answers || []).length,
        completed: session.interview?.completed || false,
      },
      tokenUsage: session.tokenUsage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: "Session details fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Get Session Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch session details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 7. DOWNLOAD ACCEPTED OPTIMIZED RESUME PDF
// ============================================
exports.downloadOptimizedPdf = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    // Verify ownership strictly - check by session ID or ATS resume ID
    let session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      session = await AIResumeSession.findOne({
        "originalResume.atsResumeId": sessionId,
        userId,
      }).sort({ createdAt: -1 });
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found or unauthorized",
      });
    }

    // Resolve best or accepted generated version, or latest version
    const acceptedVersion =
      (session.generatedVersions || []).find((v) => v.accepted) ||
      (session.bestVersion
        ? (session.generatedVersions || []).find(
            (v) => v.attemptNumber === session.bestVersion
          )
        : null) ||
      (session.generatedVersions && session.generatedVersions.length > 0
        ? session.generatedVersions[session.generatedVersions.length - 1]
        : null);

    if (!acceptedVersion || !acceptedVersion.resumeData) {
      return res.status(404).json({
        success: false,
        message: "No optimized resume version is available for download yet. Please generate the resume first.",
      });
    }

    const fullName = acceptedVersion.resumeData?.personalDetails?.fullName || "Candidate";
    const jobRole = session.jobDetails?.jobRole || "Optimized";
    const safeFilename = `${fullName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${jobRole.replace(/[^a-zA-Z0-9_-]/g, "_")}_Resume.pdf`;

    // Always generate the guaranteed single-page PDF directly from the stored accepted resume data
    const pdfResult = await generateOnePageResumePdf(acceptedVersion.resumeData);

    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("Content-Length", pdfResult.pdfBuffer.length);

    return res.send(pdfResult.pdfBuffer);
  } catch (error) {
    console.error("Download PDF Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download resume PDF",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 8. DELETE OPTIMIZATION SESSION
// ============================================
exports.deleteSession = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await AIResumeSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Optimization session not found",
      });
    }

    // Clean up any Cloudinary uploads
    const publicIds = (session.generatedVersions || [])
      .map((v) => v.publicId)
      .filter((id) => id && !id.startsWith("local-"));

    for (const pubId of publicIds) {
      try {
        await cloudinary.uploader.destroy(pubId, { resource_type: "raw" });
      } catch (cloudErr) {
        console.warn("Failed to delete Cloudinary file:", cloudErr.message);
      }
    }

    await AIResumeSession.deleteOne({ _id: sessionId });

    return res.status(200).json({
      success: true,
      message: "Optimization session and generated resources deleted successfully",
    });
  } catch (error) {
    console.error("Delete Session Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete optimization session",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================
// 9. GET USER OPTIMIZATION SESSIONS HISTORY
// ============================================
exports.getOptimizationHistory = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid user authentication",
      });
    }

    const sessions = await AIResumeSession.find({
      userId,
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const historyData = sessions.map((session) => {
      const originalScore = session.originalResume?.atsScore || 0;
      const acceptedVersion =
        (session.generatedVersions || []).find((v) => v.accepted) ||
        (session.generatedVersions || [])[session.generatedVersions?.length - 1] ||
        null;
      const isImproved = Boolean(
        acceptedVersion && acceptedVersion.atsScore > originalScore
      );

      return {
        sessionId: session._id,
        atsResumeId: session.originalResume?.atsResumeId
          ? session.originalResume.atsResumeId.toString()
          : null,
        status: session.status,
        jobRole: session.jobDetails?.jobRole || "Target Role",
        originalScore,
        optimizedScore: acceptedVersion
          ? acceptedVersion.atsScore
          : originalScore,
        improvement: isImproved ? acceptedVersion.atsScore - originalScore : 0,
        isImproved,
        completed: session.interview?.completed || false,
        hasGeneratedResume: Boolean(acceptedVersion),
        pdfUrl: acceptedVersion?.pdfUrl || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Optimization history fetched successfully",
      count: historyData.length,
      data: historyData,
    });
  } catch (error) {
    console.error("Get Optimization History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch optimization history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
