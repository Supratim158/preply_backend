const { generateStructuredJson } = require("./openaiService");
const {
  getResumeGenerationInstructions,
  getResumeGenerationInput,
} = require("../prompts/resumeGenerationPrompt");
const { validateAndSanitizeResume } = require("./resumeValidator");
const { generateOnePageResumePdf } = require("./resumePdfGenerator");

/**
 * Generate optimized resume JSON and validate 1-page PDF
 */
const generateOptimizedResume = async ({
  targetRole,
  jobDescription = "",
  originalResumeText,
  analysis,
  interviewQA = [],
  verifiedLinks = [],
  fallbackContact = {},
}) => {
  const instructions = getResumeGenerationInstructions();
  const input = getResumeGenerationInput({
    targetRole,
    jobDescription,
    originalResumeText,
    analysis,
    interviewQA,
    verifiedLinks,
  });

  const { data: rawResume, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: null,
    maxOutputTokens: 2500,
  });

  // Validate and sanitize the structured resume
  const sanitizedResume = validateAndSanitizeResume(rawResume, {
    fullName: analysis?.candidateName || fallbackContact.name || "Candidate",
    email: analysis?.contactDetails?.email || fallbackContact.email || "",
    phone: analysis?.contactDetails?.phone || fallbackContact.phone || "",
    location: analysis?.contactDetails?.location || fallbackContact.location || "",
    linkedin: analysis?.contactDetails?.linkedin || fallbackContact.linkedin || "",
    github: analysis?.contactDetails?.github || fallbackContact.github || "",
    portfolio: analysis?.contactDetails?.portfolio || fallbackContact.portfolio || "",
  });

  // Generate 1-page PDF and layout validate
  const pdfResult = await generateOnePageResumePdf(sanitizedResume);

  return {
    resumeData: sanitizedResume,
    pdfBuffer: pdfResult.pdfBuffer,
    pageCount: pdfResult.pageCount,
    isValid: pdfResult.isValid,
    profileUsed: pdfResult.profileUsed,
    usage,
  };
};

module.exports = {
  generateOptimizedResume,
};
