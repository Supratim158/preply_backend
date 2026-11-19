/**
 * Prompts for generating and managing personalized AI interview sessions
 */

const getGenerateQuestionsInstructions = () => `
You are Preply's Senior Technical Interviewer & Resume Optimization Coach.

Your job is to generate approximately 5 to 7 high-impact, personalized interview questions for a candidate aiming for a specific job role.

CRITICAL RULES:
1. Ask ONLY relevant questions.
2. DO NOT ask for information that is already clearly stated in the resume.
3. Focus on missing or insufficiently explained information that would boost the resume's ATS score and credibility.
4. Target key technologies, responsibilities, metrics, and technical challenges relevant to the target role.
5. Inquire about measurable results (e.g., user scale, latency improvements, bug reductions, team size).
6. Questions must be crisp, polite, and encouraging.
7. Return exactly 5 to 7 questions in structured JSON.
`;

const getGenerateQuestionsInput = ({
  targetRole,
  jobDescription,
  analysis,
  resumeText,
}) => `
TARGET JOB ROLE:
${targetRole}

TARGET JOB DESCRIPTION:
${jobDescription || "Standard industry expectations for " + targetRole}

RESUME ANALYSIS GAPS & TOPICS:
${JSON.stringify({
  missingKeywords: analysis?.missingKeywords || [],
  questionTopics: analysis?.questionTopics || [],
  weakSections: analysis?.weakSections || [],
})}

RESUME EXCERPT:
${resumeText.slice(0, 3000)}

Generate 5 to 7 questions.
Return JSON in exactly this structure:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text...",
      "category": "Technical Skills / Project Impact / Architecture / Achievements",
      "topic": "Specific keyword or skill (e.g. State Management, REST APIs, CI/CD)",
      "reason": "Why this question improves ATS and role fit"
    }
  ]
}
`;

const getEvaluateAnswerInstructions = () => `
You are Preply's Interview Assistant evaluating a candidate's answer during a resume optimization interview.

Analyze whether the candidate's answer provides sufficient detail or if a brief, targeted follow-up question is strictly needed to extract quantifiable metrics or technical specifics.

RULES:
1. If the candidate answered clearly, adequately, or stated "no / none / not applicable", set needsFollowUp: false.
2. Only set needsFollowUp: true if the answer is promising but vague and missing crucial details (e.g. tools used, quantifiable results, technical choices) that would directly boost their resume.
3. Keep follow-up questions concise, friendly, and specific.
4. Extract key insights and newly confirmed skills from the answer to incorporate into their optimized resume.
5. Never invent details not mentioned by the candidate.

Return JSON only.
`;

const getEvaluateAnswerInput = ({
  targetRole,
  currentQuestion,
  userAnswer,
  isFollowUpAlready = false,
}) => `
TARGET ROLE:
${targetRole}

QUESTION ASKED:
${currentQuestion.question}

TOPIC:
${currentQuestion.topic || ""}

USER ANSWER:
${userAnswer}

WAS THIS ALREADY A FOLLOW-UP QUESTION:
${isFollowUpAlready}

Return JSON in exactly this structure:
{
  "needsFollowUp": ${isFollowUpAlready ? "false" : "boolean (true ONLY if critical metric or tech details are missing and worth asking)"},
  "followUpQuestion": "Concise follow-up question or null if needsFollowUp is false",
  "insights": {
    "confirmedSkills": ["skills or tools explicitly confirmed in the answer"],
    "metricsMentioned": ["any metrics, numbers, or scale mentioned"],
    "summaryPoints": ["key achievement points to include in resume"]
  }
}
`;

module.exports = {
  getGenerateQuestionsInstructions,
  getGenerateQuestionsInput,
  getEvaluateAnswerInstructions,
  getEvaluateAnswerInput,
};
