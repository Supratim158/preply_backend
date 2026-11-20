const parseResume = require("../utils/resumeParser");
const { generateStructuredJson } = require("./openaiService");

/**
 * Configurable ATS scoring weights as specified:
 * Total: 100
 */
const ATS_CONFIGURABLE_WEIGHTS = {
  technicalSkillsMatching: 30,
  keywordMatching: 20,
  workExperienceRelevance: 20,
  projectRelevance: 10,
  resumeStructure: 10,
  achievementsAndQuantification: 10,
};

/**
 * Reusable link analysis
 */
const analyzeLinks = (links) => {
  return (links || []).map((link) => {
    let validFormat = false;
    let domain = "";
    let type = "Other";

    try {
      if (link.startsWith("tel:")) {
        return {
          url: link,
          domain: "",
          validFormat: true,
          type: "Phone",
        };
      }

      if (link.startsWith("mailto:")) {
        const email = link.replace("mailto:", "");
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
          url: link,
          domain: email.split("@")[1] || "",
          validFormat: emailRegex.test(email),
          type: "Email",
        };
      }

      const normalized = /^https?:\/\//i.test(link) ? link : `https://${link}`;
      const parsed = new URL(normalized);

      validFormat =
        ["http:", "https:"].includes(parsed.protocol) &&
        !!parsed.hostname &&
        parsed.hostname.includes(".");

      domain = parsed.hostname.toLowerCase();

      if (domain.includes("linkedin.com")) {
        type = "LinkedIn";
      } else if (domain.includes("github.com")) {
        type = "GitHub";
      } else if (
        domain.includes("vercel.app") ||
        domain.includes("netlify.app")
      ) {
        type = "Portfolio";
      } else if (domain.includes("leetcode.com")) {
        type = "LeetCode";
      } else if (domain.includes("drive.google.com")) {
        type = "Google Drive";
      }
    } catch (error) {
      validFormat = false;
    }

    return {
      url: link,
      domain,
      validFormat,
      type,
    };
  });
};

/**
 * Advanced ATS score calculation using official configurable weights:
 * ATS = Sum(CategoryScore * Weight / 100) - pagePenalty
 *
 * Scoring categories (each scored 0-100):
 * - Technical skills matching: 30
 * - Job description keyword matching: 20
 * - Work experience relevance: 20
 * - Project relevance: 10
 * - Resume structure: 10
 * - Achievements and quantification: 10
 *
 * Constraints:
 * - Resume must be exactly 1 page. Penalty applied if pageCount > 1.
 * - Dates checked for consistency & chronological timeline.
 */
const calculateATSScore = (ai, pageCount = 1, links = []) => {
  const technicalSkillsMatching = Math.max(
    0,
    Math.min(100, Number(ai.technicalSkillsMatching ?? ai.technicalSkillsScore ?? ai.skillsScore) || 0)
  );

  const keywordMatching = Math.max(
    0,
    Math.min(100, Number(ai.keywordMatching ?? ai.keywordMatchingScore ?? ai.jobMatchScore) || 0)
  );

  const workExperienceRelevance = Math.max(
    0,
    Math.min(100, Number(ai.workExperienceRelevance ?? ai.workExperienceScore ?? ai.experienceScore) || 0)
  );

  const projectRelevance = Math.max(
    0,
    Math.min(100, Number(ai.projectRelevance ?? ai.projectRelevanceScore ?? ai.projectsScore) || 0)
  );

  const resumeStructure = Math.max(
    0,
    Math.min(100, Number(ai.resumeStructure ?? ai.resumeStructureScore ?? ai.formattingScore) || 0)
  );

  const achievementsAndQuantification = Math.max(
    0,
    Math.min(
      100,
      Number(
        ai.achievementsAndQuantification ??
        ai.achievementsScore ??
        ai.quantificationScore ??
        ai.contentScore
      ) || 0
    )
  );

  // Calculate weighted sum
  const weightedSum =
    (technicalSkillsMatching * ATS_CONFIGURABLE_WEIGHTS.technicalSkillsMatching) / 100 +
    (keywordMatching * ATS_CONFIGURABLE_WEIGHTS.keywordMatching) / 100 +
    (workExperienceRelevance * ATS_CONFIGURABLE_WEIGHTS.workExperienceRelevance) / 100 +
    (projectRelevance * ATS_CONFIGURABLE_WEIGHTS.projectRelevance) / 100 +
    (resumeStructure * ATS_CONFIGURABLE_WEIGHTS.resumeStructure) / 100 +
    (achievementsAndQuantification * ATS_CONFIGURABLE_WEIGHTS.achievementsAndQuantification) / 100;

  // Single page requirement check (Page no must be 1)
  let pagePenalty = 0;
  if (pageCount === 2) {
    pagePenalty = 10;
  } else if (pageCount > 2) {
    pagePenalty = 10 + (pageCount - 2) * 5;
  }
  pagePenalty = Math.min(pagePenalty, 25);

  const atsScore = Math.max(
    0,
    Math.min(100, Math.round(weightedSum - pagePenalty))
  );

  // Link valid ratio
  const validLinks = (links || []).filter((l) => l.validFormat).length;
  const linkScore = !links || links.length === 0 ? 50 : Math.round((validLinks / links.length) * 100);

  // Detailed parameters
  const actionVerbsScore = Math.max(0, Math.min(100, Number(ai.actionVerbs?.score ?? ai.actionVerbsScore) || 80));
  const contentQualityScore = Math.max(0, Math.min(100, Number(ai.contentQuality?.score ?? ai.contentQualityScore) || 80));
  const grammarAndReadabilityScore = Math.max(0, Math.min(100, Number(ai.grammarAndReadability?.score ?? ai.grammarScore) || 85));
  const formattingScore = resumeStructure;

  // Backward compatibility fields for legacy clients
  const contentScore = Math.round(
    (workExperienceRelevance * 0.4 + projectRelevance * 0.3 + achievementsAndQuantification * 0.3)
  );
  const jobMatchScore = Math.round(
    (technicalSkillsMatching * 0.6 + keywordMatching * 0.4)
  );

  return {
    atsScore,
    scoreBreakdown: {
      // Configurable weights breakdown
      technicalSkillsMatching,
      keywordMatching,
      workExperienceRelevance,
      projectRelevance,
      resumeStructure,
      achievementsAndQuantification,
      weights: ATS_CONFIGURABLE_WEIGHTS,

      // Checked Parameters
      actionVerbs: ai.actionVerbs || { score: actionVerbsScore },
      achievements: ai.achievements || { score: achievementsAndQuantification },
      quantification: ai.quantification || { score: achievementsAndQuantification },
      formatting: ai.formatting || { score: formattingScore, isAtsFriendly: true },
      sectionStructure: ai.sectionStructure || { score: resumeStructure },
      contentQuality: ai.contentQuality || { score: contentQualityScore },
      grammarAndReadability: ai.grammarAndReadability || { score: grammarAndReadabilityScore },
      datesCheck: ai.datesCheck || { valid: true, chronological: true },

      // Page constraint
      pagePenalty,
      pageCount,
      isSinglePage: pageCount === 1,

      // Backward compatibility fields
      contentScore,
      jobMatchScore,
      formattingScore,
      linkScore,
    },
  };
};

/**
 * Advanced ATS Resume Evaluator using complete parameter checks & AI keyword extraction
 */
const evaluateResumeATS = async ({
  pdfBuffer,
  parsedData,
  targetRole,
  jobDescription = "",
}) => {
  let parsed = parsedData;

  if (pdfBuffer && !parsed) {
    parsed = await parseResume(pdfBuffer);
  }

  if (!parsed || !parsed.text || parsed.text.trim().length < 40) {
    throw new Error("Unable to extract sufficient resume text for ATS evaluation");
  }

  const links = analyzeLinks(parsed.links || []);

  const instructions = `
You are Preply's Advanced Enterprise ATS Resume Analyzer & Scoring Engine.

Your task is to perform an in-depth, rigorous ATS audit of the resume against the target role and job description according to official ATS specifications.

You must thoroughly evaluate these 10 core parameters:
1. Keyword Matching: Extract all high-value keywords, libraries, tools, and technical concepts from the job description and determine their exact match rate in the resume.
2. Skills Matching: Evaluate coverage of essential technical and soft skills.
3. Work Experience Relevance: Assess how well candidate experience aligns with the target role and check date continuity.
4. Action Verbs: Check whether bullet points start with strong action verbs (Developed, Implemented, Optimized, Engineered, Built, Spearheaded) instead of passive or weak verbs.
5. Achievements: Check for clear demonstration of results, contributions, and problem-solving.
6. Quantification: Check for specific numbers, metrics, percentages, volume, or performance stats (e.g., "50+ concurrent streams", "20% latency reduction").
7. Formatting: Check if formatting is ATS-parsable, cleanly structured, single-column, with selectable text.
8. Section Structure: Ensure required sections (Summary, Education, Skills, Internships/Experience, Projects, Certifications, Achievements) are identified.
9. Content Quality: Verify bullet points are concise, impactful, professional, and contain NO DUPLICATE WORDS or repetitive phrasing.
10. Grammar & Readability: Check for grammatical correctness, concise phrasing, and zero filler words.
11. Dates & Timeline Check: Validate start/end dates for education, internships, and projects. Confirm whether entries follow reverse chronological order and have no unaddressed discrepancies.
12. Page Length: Note that the resume must strictly fit on 1 page.

Score each category from 0 to 100 based on standard ATS benchmarks:
- technicalSkillsMatching (0-100)
- keywordMatching (0-100)
- workExperienceRelevance (0-100)
- projectRelevance (0-100)
- resumeStructure (0-100)
- achievementsAndQuantification (0-100)

Return ONLY valid JSON.
`;

  const input = `
TARGET JOB ROLE:
${targetRole}

TARGET JOB DESCRIPTION:
${jobDescription || "Standard industry benchmarks and expectations for " + targetRole}

CANDIDATE RESUME TEXT:
${parsed.text}

DETECTED RESUME LINKS:
${JSON.stringify(links)}

PAGE COUNT:
${parsed.pageCount}

Return JSON with exactly this structure:
{
  "technicalSkillsMatching": 85,
  "keywordMatching": 80,
  "workExperienceRelevance": 85,
  "projectRelevance": 90,
  "resumeStructure": 95,
  "achievementsAndQuantification": 80,

  "actionVerbs": {
    "score": 85,
    "foundVerbs": ["Developed", "Implemented", "Optimized", "Built"],
    "weakVerbs": [],
    "feedback": "Strong action verbs used throughout bullet points"
  },

  "achievements": {
    "score": 85,
    "detectedAchievements": ["Achieved 92% ML accuracy", "Cut API latency by 20%"],
    "feedback": "Measurable results clearly stated"
  },

  "quantification": {
    "score": 80,
    "metricsFound": ["50+ concurrent video streams", "92% accuracy", "20% latency reduction"],
    "feedback": "Impactful numeric metrics found"
  },

  "formatting": {
    "score": 95,
    "isAtsFriendly": true,
    "feedback": "Clean single-column layout, ATS-friendly typography"
  },

  "sectionStructure": {
    "score": 95,
    "sectionsDetected": ["Summary", "Education", "Skills", "Internships", "Projects", "Certifications", "Achievements"],
    "missingSections": []
  },

  "contentQuality": {
    "score": 88,
    "bulletPointsCheck": "Crisp and impactful bullet points",
    "duplicateWordsFound": []
  },

  "grammarAndReadability": {
    "score": 95,
    "issues": [],
    "feedback": "High readability and professional tone"
  },

  "datesCheck": {
    "valid": true,
    "chronological": true,
    "timelineConsistency": "Reverse chronological order consistently maintained",
    "issues": []
  },

  "strengths": [
    "Specific strength 1",
    "Specific strength 2"
  ],

  "weaknesses": [
    "Specific weakness 1"
  ],

  "matchedKeywords": [
    "Keyword 1", "Keyword 2"
  ],

  "missingKeywords": [
    "High-value missing keyword 1", "Missing keyword 2"
  ],

  "missingSkills": [
    "Missing skill 1"
  ],

  "jobMatch": {
    "percentage": 85,
    "summary": "Concise summary of candidate match with target role",
    "matchingSkills": ["Skill 1", "Skill 2"],
    "missingSkills": ["Skill 3"]
  },

  "suggestions": [
    "Actionable suggestion 1",
    "Actionable suggestion 2"
  ],

  "sectionsDetected": ["Summary", "Education", "Skills", "Internships", "Projects", "Certifications", "Achievements"]
}
`;

  const { data: ai, usage } = await generateStructuredJson({
    instructions,
    input,
    reasoningEffort: null,
    maxOutputTokens: 3000,
  });

  const scoring = calculateATSScore(ai, parsed.pageCount, links);

  return {
    atsScore: scoring.atsScore,
    scoreBreakdown: scoring.scoreBreakdown,
    ai,
    links,
    pageCount: parsed.pageCount,
    text: parsed.text,
    usage,
  };
};

module.exports = {
  ATS_CONFIGURABLE_WEIGHTS,
  analyzeLinks,
  calculateATSScore,
  evaluateResumeATS,
};
