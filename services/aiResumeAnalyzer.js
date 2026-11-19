const { generateStructuredJson } = require("./openaiService");
const {
  getResumeAnalysisInstructions,
  getResumeAnalysisInput,
} = require("../prompts/resumeAnalysisPrompt");

/**
 * Perform comprehensive AI analysis of the original resume against the target role
 */
const analyzeResumeForOptimization = async ({
  resumeText,
  targetRole,
  jobDescription = "",
  links = [],
}) => {
  if (!resumeText || resumeText.trim().length < 40) {
    throw new Error("Resume text is required and cannot be empty");
  }

  if (!targetRole || !targetRole.trim()) {
    throw new Error("Target job role is required");
  }

  const instructions = getResumeAnalysisInstructions();
  const input = getResumeAnalysisInput({
    resumeText,
    targetRole: targetRole.trim(),
    jobDescription: jobDescription.trim(),
    links,
  });

  const { data: analysis, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: "low",
    maxOutputTokens: 3000,
  });

  return {
    analysis: {
      jobRole: analysis.jobRole || targetRole,
      candidateName: analysis.candidateName || "",
      contactDetails: analysis.contactDetails || {},
      existingSkills: analysis.existingSkills || { technical: [], soft: [] },
      relevantSkills: analysis.relevantSkills || [],
      missingKeywords: analysis.missingKeywords || [],
      weakSections: analysis.weakSections || [],
      strongSections: analysis.strongSections || [],
      questionTopics: analysis.questionTopics || [],
      improvementSuggestions: analysis.improvementSuggestions || [],
    },
    usage,
  };
};

module.exports = {
  analyzeResumeForOptimization,
};
