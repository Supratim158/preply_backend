const cloudinary = require("../config/cloudinary");
const { generateOptimizedResume } = require("./aiResumeGenerator");
const { evaluateResumeATS } = require("./atsScoringService");
const { generateStructuredJson } = require("./openaiService");
const {
  getResumeOptimizationInstructions,
  getResumeOptimizationInput,
} = require("../prompts/resumeOptimizationPrompt");
const { validateAndSanitizeResume } = require("./resumeValidator");
const { generateOnePageResumePdf } = require("./resumePdfGenerator");

/**
 * Upload PDF buffer to Cloudinary matching existing ATS upload pattern
 */
const uploadPdfToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    // If Cloudinary keys are dummy or missing, resolve gracefully
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return resolve({
        secure_url: null,
        public_id: `local-${Date.now()}`,
      });
    }

    const publicId = `${Date.now()}-${filename
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "preply/optimized_resumes",
        resource_type: "raw",
        public_id: publicId,
        format: "pdf",
      },
      (error, result) => {
        if (error) {
          console.warn("Cloudinary upload failed, continuing with buffer storage:", error.message);
          return resolve({
            secure_url: null,
            public_id: publicId,
          });
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/**
 * Perform single resume regeneration attempt based on ATS feedback
 */
const regenerateResumeWithAtsFeedback = async ({
  currentResume,
  atsFeedback,
  targetRole,
  jobDescription,
  interviewQA,
  originalResumeText,
  fallbackContact,
}) => {
  const instructions = getResumeOptimizationInstructions();
  const input = getResumeOptimizationInput({
    currentResume,
    atsFeedback,
    targetRole,
    jobDescription,
    interviewQA,
    originalResumeText,
  });

  const { data: rawResume, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: "medium",
    maxOutputTokens: 3500,
  });

  const sanitized = validateAndSanitizeResume(rawResume, fallbackContact);
  const pdfResult = await generateOnePageResumePdf(sanitized);

  return {
    resumeData: sanitized,
    pdfBuffer: pdfResult.pdfBuffer,
    pageCount: pdfResult.pageCount,
    isValid: pdfResult.isValid,
    profileUsed: pdfResult.profileUsed,
    usage,
  };
};

/**
 * Main AI Resume Optimization loop
 * Follows strict acceptance rules:
 * - Maximum of 3 generation attempts
 * - New score must be strictly greater than original ATS score
 * - Keeps track of the best-scoring version
 * - Never overwrites a better version with a worse version
 * - If no attempt improves original score, returns no-improvement status
 */
const runResumeOptimizationLoop = async (session, userProfile = {}) => {
  if (session.isGenerating) {
    throw new Error("Optimization is already in progress for this session.");
  }

  session.isGenerating = true;
  session.status = "generating";
  await session.save();

  try {
    const originalATSScore = Number(session.originalResume?.atsScore) || 0;
    const targetRole = session.jobDetails.jobRole;
    const jobDescription = session.jobDetails.jobDescription || "";
    const originalResumeText = session.originalResume?.extractedText || "";
    const interviewQA = (session.interview?.answers || []).map((a) => ({
      question: a.question,
      answer: a.answer,
      insights: a.insights,
    }));
    const verifiedLinks = session.originalResume?.links || [];

    const fallbackContact = {
      name: session.analysis?.candidateName || userProfile.name || "Candidate",
      email: session.analysis?.contactDetails?.email || userProfile.email || "",
      phone: session.analysis?.contactDetails?.phone || "",
      location: session.analysis?.contactDetails?.location || "",
      linkedin: session.analysis?.contactDetails?.linkedin || "",
      github: session.analysis?.contactDetails?.github || "",
      portfolio: session.analysis?.contactDetails?.portfolio || "",
    };

    let bestVersionIndex = -1;
    let bestScore = -1;
    let bestResumeData = null;
    let bestPdfBuffer = null;
    let bestBreakdown = null;
    let bestAtsAnalysis = null;
    let bestPageCount = 1;

    const generatedVersions = [];

    // ============================================
    // ATTEMPT 1: Initial Generation
    // ============================================
    console.log(`[Optimization Session ${session._id}] Starting Generation Attempt 1...`);

    const attempt1 = await generateOptimizedResume({
      targetRole,
      jobDescription,
      originalResumeText,
      analysis: session.analysis,
      interviewQA,
      verifiedLinks,
      fallbackContact,
    });

    session.tokenUsage.inputTokens += attempt1.usage.inputTokens;
    session.tokenUsage.outputTokens += attempt1.usage.outputTokens;
    session.tokenUsage.totalRequests += 1;

    // Evaluate Attempt 1 using existing ATS checker
    const atsResult1 = await evaluateResumeATS({
      pdfBuffer: attempt1.pdfBuffer,
      targetRole,
      jobDescription,
    });

    session.tokenUsage.inputTokens += atsResult1.usage.inputTokens;
    session.tokenUsage.outputTokens += atsResult1.usage.outputTokens;
    session.tokenUsage.totalRequests += 1;

    console.log(`[Optimization Attempt 1] Score: ${atsResult1.atsScore} (Original: ${originalATSScore})`);

    const version1 = {
      attemptNumber: 1,
      resumeData: attempt1.resumeData,
      atsScore: atsResult1.atsScore,
      scoreBreakdown: atsResult1.scoreBreakdown,
      pageCount: attempt1.pageCount,
      accepted: false,
      atsAnalysis: atsResult1.ai,
      pdfBuffer: attempt1.pdfBuffer,
      createdAt: new Date(),
    };
    generatedVersions.push(version1);

    bestVersionIndex = 0;
    bestScore = atsResult1.atsScore;
    bestResumeData = attempt1.resumeData;
    bestPdfBuffer = attempt1.pdfBuffer;
    bestBreakdown = atsResult1.scoreBreakdown;
    bestAtsAnalysis = atsResult1.ai;
    bestPageCount = attempt1.pageCount;

    // Decide if subsequent attempts are needed:
    // If score <= originalATSScore OR (score < 85 and attempt < 3), refine further
    let currentResume = attempt1.resumeData;
    let currentAtsFeedback = {
      atsScore: atsResult1.atsScore,
      scoreBreakdown: atsResult1.scoreBreakdown,
      weaknesses: atsResult1.ai?.weaknesses || [],
      missingKeywords: atsResult1.ai?.missingKeywords || [],
      missingSkills: atsResult1.ai?.missingSkills || [],
      suggestions: atsResult1.ai?.suggestions || [],
    };

    let attemptNumber = 2;
    const maxAttempts = 3;

    while (attemptNumber <= maxAttempts) {
      // If we already achieved an excellent score (e.g. >= 88) that is higher than original, stop and avoid unnecessary modifications
      if (bestScore > originalATSScore && bestScore >= 88) {
        console.log(`[Optimization] Score ${bestScore} is already excellent. Halting further attempts.`);
        break;
      }

      // If attempt 1 was higher than original, but candidate can gain more keywords, attempt refinement
      // If attempt was lower than or equal to original, we MUST attempt improvement
      console.log(`[Optimization Session ${session._id}] Starting Generation Attempt ${attemptNumber}...`);

      const nextAttempt = await regenerateResumeWithAtsFeedback({
        currentResume,
        atsFeedback: currentAtsFeedback,
        targetRole,
        jobDescription,
        interviewQA,
        originalResumeText,
        fallbackContact,
      });

      session.tokenUsage.inputTokens += nextAttempt.usage.inputTokens;
      session.tokenUsage.outputTokens += nextAttempt.usage.outputTokens;
      session.tokenUsage.totalRequests += 1;

      const nextAtsResult = await evaluateResumeATS({
        pdfBuffer: nextAttempt.pdfBuffer,
        targetRole,
        jobDescription,
      });

      session.tokenUsage.inputTokens += nextAtsResult.usage.inputTokens;
      session.tokenUsage.outputTokens += nextAtsResult.usage.outputTokens;
      session.tokenUsage.totalRequests += 1;

      console.log(`[Optimization Attempt ${attemptNumber}] Score: ${nextAtsResult.atsScore} (Previous Best: ${bestScore})`);

      const newVersion = {
        attemptNumber,
        resumeData: nextAttempt.resumeData,
        atsScore: nextAtsResult.atsScore,
        scoreBreakdown: nextAtsResult.scoreBreakdown,
        pageCount: nextAttempt.pageCount,
        accepted: false,
        atsAnalysis: nextAtsResult.ai,
        pdfBuffer: nextAttempt.pdfBuffer,
        createdAt: new Date(),
      };
      generatedVersions.push(newVersion);

      // Only update best if new score is STRICTLY HIGHER than previous best
      if (nextAtsResult.atsScore > bestScore) {
        bestScore = nextAtsResult.atsScore;
        bestVersionIndex = generatedVersions.length - 1;
        bestResumeData = nextAttempt.resumeData;
        bestPdfBuffer = nextAttempt.pdfBuffer;
        bestBreakdown = nextAtsResult.scoreBreakdown;
        bestAtsAnalysis = nextAtsResult.ai;
        bestPageCount = nextAttempt.pageCount;
      }

      currentResume = nextAttempt.resumeData;
      currentAtsFeedback = {
        atsScore: nextAtsResult.atsScore,
        scoreBreakdown: nextAtsResult.scoreBreakdown,
        weaknesses: nextAtsResult.ai?.weaknesses || [],
        missingKeywords: nextAtsResult.ai?.missingKeywords || [],
        missingSkills: nextAtsResult.ai?.missingSkills || [],
        suggestions: nextAtsResult.ai?.suggestions || [],
      };

      attemptNumber++;
    }

    // ============================================
    // ACCEPTANCE CHECK
    // ============================================
    const isImproved = bestScore > originalATSScore;

    let finalPdfUrl = null;
    let finalPublicId = null;

    if (isImproved && bestVersionIndex >= 0) {
      generatedVersions[bestVersionIndex].accepted = true;

      const candidateName = bestResumeData.personalDetails?.fullName || "Candidate";
      const sanitizedName = candidateName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const sanitizedRole = targetRole.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${sanitizedName}_${sanitizedRole}_Resume.pdf`;

      const cloudUpload = await uploadPdfToCloudinary(bestPdfBuffer, filename);
      finalPdfUrl = cloudUpload.secure_url;
      finalPublicId = cloudUpload.public_id;

      generatedVersions[bestVersionIndex].pdfUrl = finalPdfUrl;
      generatedVersions[bestVersionIndex].publicId = finalPublicId;

      session.bestVersion = generatedVersions[bestVersionIndex].attemptNumber;
      session.status = "completed";
    } else {
      session.bestVersion = null;
      session.status = "no_improvement";
    }

    // Clean up in-memory buffer from database persistence
    session.generatedVersions = generatedVersions.map((v) => ({
      attemptNumber: v.attemptNumber,
      resumeData: v.resumeData,
      atsScore: v.atsScore,
      scoreBreakdown: v.scoreBreakdown,
      pdfUrl: v.pdfUrl,
      publicId: v.publicId,
      pageCount: v.pageCount,
      accepted: v.accepted,
      atsAnalysis: v.atsAnalysis,
      createdAt: v.createdAt,
    }));

    session.isGenerating = false;
    await session.save();

    return {
      sessionId: session._id,
      status: session.status,
      jobRole: targetRole,
      atsComparison: {
        originalScore: originalATSScore,
        optimizedScore: isImproved ? bestScore : originalATSScore,
        improvement: isImproved ? bestScore - originalATSScore : 0,
      },
      optimization: {
        attempts: generatedVersions.length,
        improved: isImproved,
        bestVersion: session.bestVersion,
      },
      resume: isImproved ? bestResumeData : null,
      pdf: isImproved
        ? {
            downloadUrl: `/api/ai-resume/download/${session._id}`,
            fileName: `${(bestResumeData?.personalDetails?.fullName || "Candidate").replace(/\s+/g, "_")}_${targetRole.replace(/\s+/g, "_")}_Resume.pdf`,
            pageCount: bestPageCount,
            pageSize: "A4",
            isValid: bestPageCount === 1,
            cloudUrl: finalPdfUrl,
          }
        : null,
      bestPdfBuffer: isImproved ? bestPdfBuffer : null,
    };
  } catch (err) {
    session.isGenerating = false;
    session.status = "failed";
    await session.save();
    throw err;
  }
};

module.exports = {
  uploadPdfToCloudinary,
  regenerateResumeWithAtsFeedback,
  runResumeOptimizationLoop,
};
