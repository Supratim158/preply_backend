/**
 * Prompts for regenerating and optimizing the resume when ATS score needs improvement
 */

const getResumeOptimizationInstructions = () => `
You are Preply's Senior ATS Optimization Engineer.

Your previous resume draft was evaluated by our ATS scoring system. Your task is to revise and improve the resume JSON to achieve a higher ATS score.

STRICT OPTIMIZATION GUIDELINES:
1. Address the specific ATS feedback, weaknesses, and missing keywords provided in the ATS evaluation report.
2. Naturally integrate missing keywords and skills that were confirmed by the candidate in their resume or interview answers.
3. Enhance phrasing in summary, experience bullet points, and project descriptions using strong industry-standard action verbs and measurable business/technical outcomes.
4. Improve section balance and formatting clarity so that the ATS parser easily recognizes all sections.
5. NEVER fabricate or invent unverified credentials, jobs, or certifications.
6. Maintain strict conciseness to guarantee the output fits exactly on ONE A4 PAGE.
7. Return the full improved resume JSON matching the exact schema.
`;

const getResumeOptimizationInput = ({
  currentResume,
  atsFeedback,
  targetRole,
  jobDescription,
  interviewQA,
  originalResumeText,
}) => `
TARGET ROLE:
${targetRole}

TARGET JOB DESCRIPTION:
${jobDescription || "Standard expectations for " + targetRole}

PREVIOUS ATS SCORE EVALUATION:
Score: ${atsFeedback.atsScore}/100
Breakdown: ${JSON.stringify(atsFeedback.scoreBreakdown)}
Weaknesses: ${JSON.stringify(atsFeedback.weaknesses || [])}
Missing Keywords: ${JSON.stringify(atsFeedback.missingKeywords || [])}
Suggestions: ${JSON.stringify(atsFeedback.suggestions || [])}
Missing Skills: ${JSON.stringify(atsFeedback.missingSkills || [])}

CURRENT RESUME DRAFT TO REFINE:
${JSON.stringify(currentResume, null, 2)}

CANDIDATE INTERVIEW INSIGHTS:
${JSON.stringify(interviewQA, null, 2)}

ORIGINAL RESUME CONTEXT:
${originalResumeText.slice(0, 2000)}

Regenerate the improved single-page resume JSON addressing the ATS weaknesses above.
Return JSON in the exact same schema:
{
  "personalDetails": { ... },
  "professionalSummary": "...",
  "skills": { "technical": [...], "soft": [...] },
  "experience": [...],
  "projects": [...],
  "education": [...],
  "certifications": [...]
}
`;

module.exports = {
  getResumeOptimizationInstructions,
  getResumeOptimizationInput,
};
