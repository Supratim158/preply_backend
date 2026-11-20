/**
 * Prompts for regenerating and optimizing the resume when ATS score needs improvement
 * Enforces:
 * - Elimination of all detected ATS weaknesses and inclusion of missing keywords
 * - No duplicate words or repetitive action verbs
 * - All content in crisp bullet points
 * - High density of quantifiable metrics and tech stack keywords
 * - Chronological and valid dates
 * - Strict 1-page fit
 */

const getResumeOptimizationInstructions = () => `
You are Preply's Senior ATS Optimization Engineer.

Your previous resume draft was evaluated by our ATS scoring system. Your task is to revise and improve the resume JSON to achieve a higher ATS score.

STRICT OPTIMIZATION GUIDELINES:
1. Address the specific ATS feedback, weaknesses, and missing keywords provided in the ATS evaluation report.
2. Naturally integrate missing keywords and skills that were confirmed by the candidate in their resume or interview answers.
3. Enhance phrasing in summary, experience bullet points, and project descriptions using strong, diverse industry-standard action verbs and measurable business/technical outcomes.
4. NO DUPLICATE WORDS:
   - Ensure varied, non-repetitive vocabulary.
   - Do not repeat identical action verbs across bullet points.
5. ALL POINTS IN BULLET POINTS:
   - Ensure every experience responsibility, project highlight, and achievement is formatted as a crisp bullet point starting with an action verb and containing metrics.
6. DATES & TIMELINE CONSISTENCY:
   - Ensure valid dates formatted chronologically (e.g., "Mar 2025 – Jun 2025", "2023 – 2027").
7. STRICT SINGLE-PAGE FIT:
   - Maintain strict conciseness so the entire resume renders on exactly 1 A4 page.
8. NEVER fabricate or invent unverified credentials, jobs, or certifications.
9. Return the full improved resume JSON matching the exact schema.
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
${originalResumeText.slice(0, 2500)}

Regenerate the improved single-page resume JSON addressing all ATS weaknesses and missing keywords above.
Ensure NO duplicate words and ALL points are crisp bullet points.
Return JSON in the exact same schema:
{
  "personalDetails": {
    "fullName": "Candidate Full Name",
    "location": "City, State",
    "phone": "+91-XXXXXXXXXX",
    "email": "email@example.com",
    "linkedin": "https://linkedin.com/in/...",
    "github": "https://github.com/...",
    "portfolio": "https://..."
  },
  "professionalSummary": "...",
  "education": [
    {
      "institution": "...",
      "degree": "...",
      "grade": "...",
      "location": "...",
      "startDate": "...",
      "endDate": "..."
    }
  ],
  "skills": {
    "languages": [...],
    "frameworks": [...],
    "developerTools": [...],
    "coreSkills": [...]
  },
  "experience": [
    {
      "jobTitle": "...",
      "company": "...",
      "roleType": "...",
      "location": "...",
      "startDate": "...",
      "endDate": "...",
      "current": false,
      "responsibilities": [...]
    }
  ],
  "projects": [
    {
      "title": "...",
      "technologies": [...],
      "startDate": "...",
      "endDate": "...",
      "link": "...",
      "highlights": [...]
    }
  ],
  "certifications": [
    {
      "name": "...",
      "issuer": "...",
      "date": "...",
      "url": "..."
    }
  ],
  "achievements": [
    "..."
  ]
}
`;

module.exports = {
  getResumeOptimizationInstructions,
  getResumeOptimizationInput,
};
