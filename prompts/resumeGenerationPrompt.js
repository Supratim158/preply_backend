/**
 * Prompts for generating the optimized resume JSON matching the exact visual structure
 * and ATS criteria:
 * - Sections: Summary, Education, Skills, Internships/Experience, Projects, Certifications, Achievements
 * - No duplicate words or repetitive action verbs
 * - All responsibilities and highlights in bullet points
 * - High density of ATS-friendly keywords and quantified metrics
 * - Chronological and valid dates
 * - Single-page conciseness
 */

const getResumeGenerationInstructions = () => `
You are Preply's Master Executive Resume Writer and ATS Optimization Specialist.

Your mission is to generate a pristine, high-scoring, ATS-optimized single-page resume for the candidate matching the exact professional formatting shown in top industry engineering resumes.

CORE SECTION ARCHITECTURE (IN EXACT ORDER):
1. personalDetails: Full Name, Location, Phone, Email, LinkedIn, GitHub, Portfolio.
2. professionalSummary: 3-4 sentences packed with ATS keywords, core strengths, and domain expertise.
3. education: Degrees/schools with exact dates, locations, and grades (CGPA/percentages).
4. skills: Categorized cleanly into:
   - languages
   - frameworks (and technologies)
   - developerTools
   - coreSkills
5. experience (or Internships): Roles with company, dates, location, and strong bullet points.
6. projects: Key projects with tech stack, dates, links, and impact bullet points.
7. certifications: Credible certifications with issuer and year.
8. achievements: Specific awards, competitive programming stats (e.g., LeetCode/Hackathons), leadership roles.

STRICT CONSTRAINTS & QUALITY RULES:
1. PROJECT TITLE - ONLY 2 TO 3 MAIN TECHNOLOGIES:
   - Beside the project title in "technologies", specify ONLY the 2 to 3 main primary tech stack technologies (e.g., ["Flutter", "Node.js", "MongoDB"] or ["Flask", "OpenCV", "TensorFlow"]).
   - DO NOT list secondary libraries, packages, or tools (like Riverpod, Cloudinary, Express.js, REST APIs, YOLOv8, Render) in the project technologies array.
   - WEAVE ALL other secondary technologies, frameworks, libraries, protocols, and deployment details into the DETAILED BULLET POINTS!
2. DETAILED BULLET POINTS WITH RICH CONTEXT & NUMBERS:
   - Every single bullet point under Projects and Internships/Experience must be detailed, comprehensive, and packed with concrete metrics and numbers (% latency reduction, 50+ concurrent streams, 92% accuracy, 200+ students, 35% discovery improvement, 3-tier architecture).
   - Provide 2 to 3 thorough, detailed bullet points per project and internship.
3. FULL-PAGE FULFILLMENT ACCORDING TO JOB ROLE & DESCRIPTION:
   - Tailor the summary, skills, experience, and project descriptions directly to the target job role and job description.
   - Calibrate the detail and length of the content so that it elegantly FULFILLS THE FULL A4 PAGE from top to bottom without overflowing onto page 2.
4. NO DUPLICATE WORDS OR REDUNDANT PHRASING:
   - Do not repeat the same action verbs across consecutive bullet points.
   - Use diverse, powerful action verbs: Developed, Implemented, Optimized, Engineered, Architected, Automated, Streamlined, Spearheaded, Built, Designed.
   - Avoid filler words and repetitive buzzwords.
5. ALL POINTS IN BULLET POINTS:
   - Every responsibility, project highlight, and achievement MUST be a crisp, standalone bullet point starting with a strong action verb.
6. VALID CHRONOLOGICAL DATES:
   - Include clear, professional date formats for all education, experience, and project entries (e.g. "Mar 2025 – Jun 2025", "2023 – 2027", "Feb 2026 – Present").
   - Maintain reverse chronological order.
7. TRUTHFUL & ACCURATE:
   - Anchor qualifications in the user's real resume and interview confirmations. Never hallucinate unverified companies or degrees.

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
${originalResumeText.slice(0, 4500)}

VERIFIED ORIGINAL LINKS:
${JSON.stringify(verifiedLinks)}

Generate the optimized single-page resume JSON in EXACTLY this structure:
{
  "personalDetails": {
    "fullName": "Candidate Full Name",
    "location": "City, State/Country",
    "phone": "+91-XXXXXXXXXX",
    "email": "candidate@email.com",
    "linkedin": "https://linkedin.com/in/... or empty string",
    "github": "https://github.com/... or empty string",
    "portfolio": "https://... or empty string"
  },
  "professionalSummary": "Aspiring Full-Stack Developer with hands-on experience building scalable applications...",
  "education": [
    {
      "institution": "University / Institution Name",
      "degree": "B.Tech - Computer Science and Engineering",
      "grade": "CGPA: 8.6",
      "location": "City, State",
      "startDate": "2023",
      "endDate": "2027"
    }
  ],
  "skills": {
    "languages": ["Java", "Python", "JavaScript", "Dart", "SQL"],
    "frameworks": ["Flutter", "Node.js", "Express.js", "MongoDB", "REST APIs", "Git"],
    "developerTools": ["VS Code", "Android Studio", "GitHub", "Postman"],
    "coreSkills": ["Full-Stack Development", "Data Structures and Algorithms", "Agile"]
  },
  "experience": [
    {
      "jobTitle": "Summer Intern – Organization",
      "company": "Organization Name",
      "roleType": "Developer Role",
      "location": "City, State",
      "startDate": "Mar 2025",
      "endDate": "Jun 2025",
      "current": false,
      "responsibilities": [
        "Built a scalable backend service handling 50+ concurrent data streams with OpenCV integration.",
        "Trained and fine-tuned ML models achieving 92% accuracy in real-time classification.",
        "Optimized database indexing and caching, reducing query latency by 20% and enhancing throughput."
      ]
    }
  ],
  "projects": [
    {
      "title": "Project Name",
      "technologies": ["Flutter (Dart)", "Node.js", "MongoDB"],
      "startDate": "Feb 2026",
      "endDate": "Present",
      "link": "https://github.com/... or verified link",
      "highlights": [
        "Architected a cross-platform application utilizing clean 3-tier architecture, Riverpod state management, and REST APIs across 5+ core features.",
        "Developed 10+ secure REST API endpoints in Express.js with JWT authentication and MongoDB Atlas data persistence.",
        "Integrated Cloudinary for media asset management, enabling 100% cloud-hosted deployment on Render."
      ]
    }
  ],
  "certifications": [
    {
      "name": "Machine Learning with Python",
      "issuer": "Issuing Body",
      "date": "2024",
      "url": ""
    }
  ],
  "achievements": [
    "Solved 100+ DSA problems on LeetCode covering Arrays, Trees, Graphs, and Dynamic Programming.",
    "Core Team Member of Tech Fest as Media Lead, leading outreach across 500+ participants."
  ]
}
`;

module.exports = {
  getResumeGenerationInstructions,
  getResumeGenerationInput,
};
