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
3. PROJECT TITLE - ONLY 2 TO 3 MAIN TECHNOLOGIES:
   - Beside each project title in "technologies", specify ONLY the 2 to 3 main primary tech stack technologies (e.g. ["Flutter", "Node.js", "MongoDB"] or ["Flask", "OpenCV", "TensorFlow"]).
   - DO NOT put secondary libraries, state management, or deployment tools in the project technologies array.
   - WEAVE ALL other secondary technologies (Riverpod, Cloudinary, Express.js, REST APIs, YOLOv8, Render) into the DETAILED BULLET POINTS!
4. DETAILED BULLET POINTS WITH RICH CONTEXT & NUMBERS:
   - Every single bullet point under Projects and Internships/Experience must be detailed, comprehensive, and packed with concrete metrics and numbers (% latency reduction, 50+ concurrent streams, 92% accuracy, 200+ students, 35% discovery improvement).
   - Provide 2 to 3 thorough, detailed bullet points per project and internship.
5. FULL-PAGE FULFILLMENT ACCORDING TO JOB ROLE & DESCRIPTION:
   - Tailor the summary, skills, experience, and project descriptions directly to the target job role and description.
   - Calibrate the detail and length of the content so that it elegantly FULFILLS THE FULL A4 PAGE without overflowing onto page 2.
6. NO DUPLICATE WORDS:
   - Ensure varied, non-repetitive vocabulary.
   - Do not repeat identical action verbs across bullet points.
7. ALL POINTS IN BULLET POINTS:
   - Ensure every experience responsibility, project highlight, and achievement is formatted as a crisp bullet point starting with an action verb and containing metrics.
8. DATES & TIMELINE CONSISTENCY:
   - Ensure valid dates formatted chronologically (e.g., "Mar 2025 – Jun 2025", "2023 – 2027").
9. NEVER fabricate or invent unverified credentials, jobs, or certifications.
10. Return the full improved resume JSON matching the exact schema.
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
