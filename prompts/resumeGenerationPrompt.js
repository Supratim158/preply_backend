/**
 * Prompts for generating the optimized resume JSON
 */

const getResumeGenerationInstructions = () => `
You are Preply's Master Executive Resume Writer and ATS Optimization Specialist.

Your mission is to generate a pristine, high-scoring, ATS-optimized single-page resume for the candidate based on:
1. Their original resume text and extracted details.
2. The target job role and job description.
3. The AI analysis identifying strengths and weaknesses.
4. The candidate's confirmed interview answers.

STRICT REQUIREMENTS & HARD CONSTRAINTS:
1. NEVER INVENT OR HALLUCINATE: Do not create fake jobs, companies, degrees, dates, metrics, or technologies that were not in the original resume or explicitly confirmed by the user in the interview answers.
2. PRESERVE CANDIDATE IDENTITY: Keep the user's exact full name, email, phone, location, and valid social links (LinkedIn, GitHub, Portfolio). Do not hallucinate URLs.
3. ATS KEYWORD ALIGNMENT: Weave in relevant keywords from the job description and interview answers naturally using strong action verbs (e.g., Engineered, Architected, Deployed, Accelerated, Streamlined). Avoid keyword stuffing.
4. QUANTIFY ACHIEVEMENTS: Use metrics, numbers, and scale from the resume and interview answers wherever provided.
5. STRICT SINGLE-PAGE CONCISENESS:
   - Summary: Max 3-4 impactful sentences.
   - Experience: 2-3 top relevant roles. 2-3 concise bullet points each.
   - Projects: 2-3 top relevant projects. 2 concise bullet points each with tech stack.
   - Skills: Crisp comma-separated items grouped into technical and soft skills.
   - Education: 1-2 degrees.
   - Certifications: Only include if verified in resume or user answers.
   - NO EMPTY SECTIONS: If no certifications exist, return an empty array [].
6. All text must be clear, professional, and ATS-friendly.

Return ONLY valid JSON.
`;

const getResumeGenerationInput = ({
  targetRole,
  jobDescription,
  originalResumeText,
  analysis,
  interviewQA,
  verifiedLinks = [],
}) => `
TARGET JOB ROLE:
${targetRole}

TARGET JOB DESCRIPTION:
${jobDescription || "Standard industry requirements for " + targetRole}

INTERVIEW QUESTION & ANSWER INSIGHTS:
${JSON.stringify(interviewQA, null, 2)}

ORIGINAL RESUME ANALYSIS & KEYWORDS:
${JSON.stringify({
  missingKeywords: analysis?.missingKeywords || [],
  relevantSkills: analysis?.relevantSkills || [],
  candidateName: analysis?.candidateName || "",
  contactDetails: analysis?.contactDetails || {},
})}

ORIGINAL RESUME RAW TEXT:
${originalResumeText.slice(0, 4000)}

VERIFIED ORIGINAL LINKS:
${JSON.stringify(verifiedLinks)}

Generate the optimized single-page resume JSON in EXACTLY this structure:
{
  "personalDetails": {
    "fullName": "Candidate Full Name",
    "email": "user@email.com",
    "phone": "+1234567890",
    "location": "City, Country",
    "linkedin": "https://linkedin.com/in/... or empty string",
    "github": "https://github.com/... or empty string",
    "portfolio": "https://... or empty string"
  },
  "professionalSummary": "Concise 3-4 sentence professional summary tailored to ${targetRole} with key keywords and impact.",
  "skills": {
    "technical": ["Skill 1", "Skill 2"],
    "soft": ["Skill 1", "Skill 2"]
  },
  "experience": [
    {
      "jobTitle": "Job Title",
      "company": "Company Name",
      "location": "Location",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "current": false,
      "responsibilities": [
        "Action verb + achievement + metrics + technical keyword",
        "Action verb + technical accomplishment"
      ]
    }
  ],
  "projects": [
    {
      "title": "Project Name",
      "description": "1 sentence overview",
      "technologies": ["Tech 1", "Tech 2"],
      "link": "Verified URL or empty string",
      "highlights": [
        "Measurable feature, challenge solved, or optimization"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / College Name",
      "location": "City, Country",
      "startDate": "YYYY",
      "endDate": "YYYY"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Body",
      "date": "YYYY",
      "url": "Verified URL or empty string"
    }
  ]
}
`;

module.exports = {
  getResumeGenerationInstructions,
  getResumeGenerationInput,
};
