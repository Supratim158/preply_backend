
const SECTION_PATTERNS = {
  summary: /\b(summary|professional summary|career objective|objective|profile)\b/i,
  skills: /\b(technical skills|skills|core competencies|key skills)\b/i,
  experience: /\b(work experience|professional experience|employment history|internships?)\b/i,
  education: /\b(education|academic background|qualifications)\b/i,
  projects: /\b(projects|personal projects|academic projects|key projects)\b/i,
  certifications: /\b(certifications?|licenses?|professional credentials)\b/i,
};

const WEIGHTS = {
  keywordMatch: 0.40,
  skillsCoverage: 0.20,
  parseFormatting: 0.15,
  experienceAlignment: 0.12,
  titleAndSections: 0.08,
  educationCertificationsImpact: 0.05,
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our",
  "this", "that", "will", "have", "has", "from", "into",
  "years", "year", "work", "role", "job", "team", "using",
  "required", "preferred", "ability", "experience", "skills",
  "responsibilities", "responsibility", "including", "include",
  "including", "strong", "good", "excellent", "candidate",
  "candidates", "must", "should", "would", "their", "they",
  "them", "who", "what", "when", "where", "which", "while",
  "within", "across", "such", "other", "about", "also",
  "provide", "support", "work", "working", "ensure", "help",
  "looking", "seeking", "ability", "knowledge", "proven",
  "demonstrated", "responsible", "related", "relevant",
  "preferred", "plus", "etc", "new", "well", "one", "two",
]);

const SKILL_LEXICON = [
  "java", "python", "javascript", "typescript", "dart", "c++",
  "c#", "golang", "go", "kotlin", "swift", "php", "ruby",
  "flutter", "react", "react native", "angular", "vue",
  "node.js", "express.js", "express", "next.js", "html", "css",
  "tailwind css", "bootstrap", "rest api", "restful api",
  "graphql", "microservices", "api development",
  "mongodb", "mongoose", "postgresql", "mysql", "sql",
  "firebase", "firestore", "redis", "oracle", "sqlite",
  "git", "github", "gitlab", "docker", "kubernetes",
  "aws", "azure", "google cloud", "gcp", "vercel",
  "ci/cd", "jenkins", "linux", "postman", "swagger",
  "jest", "mocha", "selenium", "unit testing",
  "integration testing", "debugging", "testing",
  "data structures", "algorithms", "object oriented programming",
  "oop", "system design", "operating systems",
  "database management systems", "dbms", "computer networks",
  "machine learning", "deep learning", "artificial intelligence",
  "generative ai", "large language models", "llm", "nlp",
  "natural language processing", "computer vision",
  "tensorflow", "pytorch", "scikit-learn", "sklearn",
  "pandas", "numpy", "opencv", "yolo", "data analysis",
  "data visualization", "power bi", "tableau", "excel",
  "agile", "scrum", "jira", "project management",
  "communication", "leadership", "problem solving",
  "critical thinking", "teamwork", "collaboration",
  "analytical skills", "time management",
];

const SYNONYMS = {
  "node.js": ["nodejs", "node js"],
  "express.js": ["express", "expressjs"],
  "express": ["express.js", "expressjs"],
  "rest api": ["restful api", "rest apis", "restful apis"],
  "restful api": ["rest api", "rest apis"],
  "javascript": ["js"],
  "typescript": ["ts"],
  "postgresql": ["postgres", "postgres sql"],
  "mongodb": ["mongo", "mongo db"],
  "react": ["reactjs", "react.js"],
  "next.js": ["nextjs", "next js"],
  "machine learning": ["ml"],
  "artificial intelligence": ["ai"],
  "large language models": ["llm", "llms"],
  "natural language processing": ["nlp"],
  "scikit-learn": ["sklearn", "scikit learn"],
  "c++": ["cpp"],
  "c#": ["c sharp"],
  "ci/cd": ["continuous integration", "continuous delivery"],
  "object oriented programming": ["oop", "object-oriented programming"],
  "database management systems": ["dbms"],
  "google cloud": ["gcp", "google cloud platform"],
  "amazon web services": ["aws"],
  "problem solving": ["problem-solving"],
};
 
const FOUNDATIONAL_KEYWORDS = [
  "git", "github", "rest api", "testing", "debugging",
  "data structures", "algorithms", "agile", "ci/cd",
  "problem solving", "communication", "teamwork", "leadership",
  "system design", "database", "api development", "unit testing",
];

const ACTION_VERBS = [
  "built", "developed", "implemented", "designed", "improved",
  "created", "led", "optimized", "automated", "delivered",
  "reduced", "increased", "deployed", "engineered", "launched",
  "integrated", "managed", "analyzed", "streamlined", "resolved",
];

const DEGREE_PATTERNS = [
  { name: "phd", regex: /\b(ph\.?\s*d\.?|doctorate|doctoral)\b/i, level: 4 },
  { name: "masters", regex: /\b(master'?s|m\.?\s*tech|m\.?\s*e\.?|m\.?\s*sc|mba|mca)\b/i, level: 3 },
  { name: "bachelors", regex: /\b(bachelor'?s|b\.?\s*tech|b\.?\s*e\.?|b\.?\s*sc|bca|b\.?\s*s\.?)\b/i, level: 2 },
  { name: "diploma", regex: /\b(diploma|associate'?s degree)\b/i, level: 1 },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasKeyword(text, keyword) {
  const escaped = escapeRegex(keyword);
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i")
    .test(text);
}

function normalizeText(text = "") {
  return String(text)
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function findSkillTerms(text) {
  return SKILL_LEXICON.filter((skill) => hasKeyword(text, skill));
}

function findContactInfo(text) {
  return {
    emailFound: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text),
    phoneFound: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d[\d\s().-]{6,}\d/.test(text),
    linkedinFound: /linkedin\.com\/in\/[\w-]+/i.test(text),
    githubFound: /github\.com\/[\w-]+/i.test(text),
  };
}

function extractKeywords(jobDescription) {
  const jd = normalizeText(jobDescription);
  if (!jd) return [];

  const entries = new Map();

  function add(term, source = "general") {
    term = term.trim().toLowerCase();
    if (!term || term.length < 2 || STOP_WORDS.has(term)) return;

    const existing = entries.get(term);
    if (!existing) {
      entries.set(term, { term, source });
    } else if (source === "required") {
      existing.source = "required";
    }
  }

  // Known technical and professional terms.
  for (const skill of SKILL_LEXICON) {
    if (hasKeyword(jd, skill)) add(skill, "skill");
  }

  // Capture certification names and selected technical phrases.
  const phrasePatterns = [
    /\b(?:bachelor'?s|master'?s|ph\.?d\.?|b\.?tech|m\.?tech|mba|mca)\b/gi,
    /\b[A-Z][A-Za-z+#.-]*(?:\s+[A-Z][A-Za-z+#.-]*){1,4}\b/g,
    /\b\d+\+?\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience\b/gi,
  ];

  for (const pattern of phrasePatterns) {
    for (const match of String(jobDescription).matchAll(pattern)) {
      add(match[0], "general");
    }
  }

  // Weight terms mentioned in requirements sections more highly.
  const requiredMatch = String(jobDescription).match(
    /(?:requirements|must have|required qualifications|minimum qualifications|what you.ll need)([\s\S]{0,1800})/i
  );
  const requiredText = normalizeText(requiredMatch?.[1] || "");

  for (const skill of SKILL_LEXICON) {
    if (requiredText && hasKeyword(requiredText, skill)) {
      add(skill, "required");
    }
  }

  // Add meaningful recurring terms, excluding common filler words.
  const words = jd.match(/\b[a-z][a-z0-9+#.-]{1,}\b/g) || [];
  const frequencies = new Map();

  for (const word of words) {
    if (!STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
  }

  for (const [word, frequency] of frequencies) {
    if (frequency >= 2) add(word, "general");
  }

  return [...entries.values()].slice(0, 60).map((entry) => {
    const occurrences = countMatches(
      jd,
      new RegExp(escapeRegex(entry.term), "gi")
    );

    const isRequired =
      entry.source === "required" ||
      /\b(must|required|mandatory|minimum)\b/i.test(
        jd.slice(
          Math.max(0, jd.indexOf(entry.term) - 100),
          jd.indexOf(entry.term) + entry.term.length + 100
        )
      );

    const isTool = SKILL_LEXICON.includes(entry.term);

    return {
      term: entry.term,
      tier: isRequired || occurrences >= 3 ? "tier1" : isTool ? "tool" : "general",
      weight: isRequired || occurrences >= 3 ? 2 : isTool ? 1.5 : 1,
      required: isRequired,
    };
  });
}

function matchesTerm(text, term) {
  if (hasKeyword(text, term)) return { matched: true, type: "exact" };

  const alternatives = SYNONYMS[term] || [];
  const synonym = alternatives.find((alt) => hasKeyword(text, alt));

  return synonym
    ? { matched: true, type: "synonym", synonym }
    : { matched: false, type: "missing" };
}

function scoreKeywords(resume, jobDescription) {
  const jd = normalizeText(jobDescription);

  if (!jd) {
    // General mode: score based on foundational tech/professional keywords and skills found
    const detectedSkills = findSkillTerms(resume);
    const matches = [];
    const missing = [];

    for (const term of FOUNDATIONAL_KEYWORDS) {
      if (matchesTerm(resume, term).matched) {
        matches.push(term);
      } else {
        missing.push(term);
      }
    }

    for (const skill of detectedSkills) {
      if (!matches.includes(skill)) {
        matches.push(skill);
      }
    }

    const count = matches.length;
    let score = 30;
    if (count >= 15) score = 95;
    else if (count >= 10) score = 85 + (count - 10) * 2;
    else if (count >= 6) score = 70 + (count - 6) * 3;
    else if (count >= 3) score = 55 + (count - 3) * 5;
    else if (count >= 1) score = 40 + count * 7;

    return {
      score: Math.min(100, score),
      keywordsAnalyzed: FOUNDATIONAL_KEYWORDS.length + detectedSkills.length,
      matchedKeywords: matches,
      missingKeywords: missing.slice(0, 10),
      requiredKeywords: [],
      stuffingPenalty: 0,
      keywordInventory: [],
    };
  }

  const keywords = extractKeywords(jobDescription);
  const matches = [];
  const missing = [];
  let earned = 0;
  let possible = 0;
  let stuffingPenalty = 0;

  for (const item of keywords) {
    const result = matchesTerm(resume, item.term);
    possible += item.weight;

    if (result.matched) {
      const occurrences = countMatches(
        resume,
        new RegExp(escapeRegex(result.type === "synonym" ? result.synonym : item.term), "gi")
      );

      const index = resume.indexOf(
        result.type === "synonym" ? result.synonym : item.term
      );
      const topThird = index >= 0 && index < resume.length / 3;

      const hasContext =
        /\b(developed|built|implemented|designed|optimized|deployed|led|created|improved|integrated|engineered)\b/i
          .test(resume.slice(Math.max(0, index - 100), index + item.term.length + 100));

      // Synonyms get partial credit. Placement boosts are deliberately capped.
      let credit = result.type === "exact" ? 1 : 0.7;
      if (topThird) credit += 0.1;
      if (hasContext) credit += 0.15;
      credit = Math.min(1.25, credit);

      earned += item.weight * credit;

      matches.push(item.term);

      if (occurrences > 5) stuffingPenalty += Math.min(2, occurrences - 5);
    } else {
      missing.push(item.term);
    }
  }

  const rawScore = possible ? (earned / possible) * 100 : 0;
  const score = Math.max(0, Math.min(100, rawScore - stuffingPenalty));

  return {
    score: Math.round(score),
    keywordsAnalyzed: keywords.length,
    matchedKeywords: matches,
    missingKeywords: missing,
    requiredKeywords: keywords.filter((k) => k.required).map((k) => k.term),
    stuffingPenalty: Math.round(stuffingPenalty * 10) / 10,
    keywordInventory: keywords,
  };
}

function scoreSkills(resume, jobDescription, keywordResult) {
  const jd = normalizeText(jobDescription);

  if (!jd) {
    // General mode: score based on number of skills identified from lexicon
    const matchedSkills = findSkillTerms(resume);
    const count = matchedSkills.length;

    let score = 25;
    if (count >= 12) score = 95;
    else if (count >= 8) score = 85 + (count - 8) * 2;
    else if (count >= 5) score = 70 + (count - 5) * 5;
    else if (count >= 3) score = 55 + (count - 3) * 7;
    else if (count >= 1) score = 40 + count * 7;

    const commonBestPracticeSkills = ["git", "rest api", "unit testing", "ci/cd", "docker", "agile"];
    const missingSkills = commonBestPracticeSkills.filter((s) => !matchedSkills.includes(s));

    return {
      score: Math.min(100, score),
      requiredSkills: [],
      preferredSkills: [],
      matchedSkills,
      missingSkills,
    };
  }

  const requiredSkills = findSkillTerms(jd);
  const preferredSkills = [];

  const preferredMatch = jd.match(
    /(?:preferred qualifications|nice to have|bonus points|desired skills)([\s\S]{0,1200})/i
  );

  if (preferredMatch) {
    preferredSkills.push(
      ...findSkillTerms(preferredMatch[1])
    );
  }

  const required = [...new Set(requiredSkills)].filter(
    (skill) => !preferredSkills.includes(skill)
  );

  let earned = 0;
  let possible = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of required) {
    possible += 1;
    const result = matchesTerm(resume, skill);

    if (result.matched) {
      earned += result.type === "exact" ? 1 : 0.7;
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  for (const skill of new Set(preferredSkills)) {
    possible += 0.5;
    const result = matchesTerm(resume, skill);

    if (result.matched) {
      earned += result.type === "exact" ? 0.5 : 0.35;
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // When no technical skills are identifiable in the JD, use keyword
  // coverage as a fallback rather than giving an automatic perfect score.
  const score = possible
    ? Math.round((earned / possible) * 100)
    : (keywordResult ? keywordResult.score : 50);

  return {
    score,
    requiredSkills: required,
    preferredSkills: [...new Set(preferredSkills)],
    matchedSkills: [...new Set(matchedSkills)],
    missingSkills: [...new Set(missingSkills)],
  };
}

function scoreParsingAndFormatting(text) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const contact = findContactInfo(text);
  const sections = Object.values(SECTION_PATTERNS).filter((p) => p.test(text)).length;

  let score = 0;
  const checks = {
    extractedTextAvailable: wordCount >= 50,
    reasonableWordCount: wordCount >= 100 && wordCount <= 2500,
    recognizableSections: sections >= 3,
    contactDetailsInExtractedText: contact.emailFound || contact.phoneFound,
    lineStructureAvailable: lines.length >= 5,
    documentLayout: "unverified",
    fontChoice: "unverified",
    columnsAndTextBoxes: "unverified",
    iconsAndGraphics: "unverified",
    dateConsistency: "unverified",
  };

  if (checks.extractedTextAvailable) score += 25;
  if (checks.reasonableWordCount) score += 20;
  if (checks.recognizableSections) score += 20;
  if (checks.contactDetailsInExtractedText) score += 15;
  if (checks.lineStructureAvailable) score += 20;

  return {
    score,
    checks,
    wordCount,
    lineCount: lines.length,
    note: "Text extraction quality is estimated. Visual layout, fonts, columns, headers and graphics require document-level inspection.",
  };
}

function extractRequiredYears(jobDescription) {
  const matches = [
    ...jobDescription.matchAll(
      /(\d+)\+?\s*(?:-|to)\s*(\d+)\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience/gi
    ),
  ];

  if (matches.length) {
    return {
      minimum: Number(matches[0][1]),
      maximum: Number(matches[0][2]),
    };
  }

  const single = jobDescription.match(
    /(?:at least|minimum of|min\.?)\s*(\d+)\+?\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience|(\d+)\+?\s+years?(?:\s+of)?\s+(?:relevant\s+)?experience required/i
  );

  return single
    ? { minimum: Number(single[1] || single[2]), maximum: null }
    : null;
}

function estimateResumeYears(text) {
  const years = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)]
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1970 && year <= new Date().getFullYear() + 1);

  if (years.length < 2) return null;

  // This is only a rough estimate: education and project dates can
  // otherwise inflate experience, so flag it as an estimate.
  return Math.max(0, Math.max(...years) - Math.min(...years));
}

function scoreExperience(resume, jobDescription) {
  const jd = normalizeText(jobDescription);
  const hasExperienceSection = SECTION_PATTERNS.experience.test(resume);
  const hasProjects = SECTION_PATTERNS.projects.test(resume);
  const hasDates = /\b(?:19|20)\d{2}\b/.test(resume);

  const requiredYears = jd ? extractRequiredYears(jd) : null;
  const estimatedYears = estimateResumeYears(resume);

  let score = 0;
  if (hasExperienceSection) score += 35;
  if (hasDates) score += 15;
  if (hasProjects) score += 10;

  const resumeActionVerbs = countMatches(
    resume,
    new RegExp(`\\b(?:${ACTION_VERBS.join("|")})\\b`, "gi")
  );

  score += Math.min(20, resumeActionVerbs * 2);

  const relevantTerms = jd ? findSkillTerms(jd) : [];
  if (relevantTerms.length) {
    const matchedRelevantTerms = relevantTerms.filter(
      (term) => matchesTerm(resume, term).matched
    );
    score += Math.round((matchedRelevantTerms.length / relevantTerms.length) * 20);
  } else {
    // General mode: award points for projects and action verbs
    score += Math.min(20, (hasProjects ? 10 : 0) + (resumeActionVerbs >= 4 ? 10 : 5));
  }

  const hardFilterWarnings = [];

  if (requiredYears && estimatedYears !== null) {
    if (estimatedYears < requiredYears.minimum) {
      hardFilterWarnings.push({
        type: "experience_years",
        severity: "review",
        required: requiredYears.minimum,
        estimated: estimatedYears,
        message: "The date-range estimate may be below the job's stated experience requirement. Verify actual relevant experience before applying a penalty.",
      });
    }
  } else if (requiredYears) {
    hardFilterWarnings.push({
      type: "experience_years",
      severity: "unverified",
      required: requiredYears.minimum,
      estimated: null,
      message: "Required experience was detected, but resume dates do not support a reliable estimate.",
    });
  }

  return {
    score: Math.min(100, score),
    requiredYears,
    estimatedYears,
    estimatedYearsIsReliable: false,
    hardFilterWarnings,
  };
}

function scoreTitleAndSections(resume, jobDescription) {
  const sectionMatches = Object.entries(SECTION_PATTERNS)
    .filter(([, pattern]) => pattern.test(resume))
    .map(([name]) => name);

  const standardSectionScore = Math.round(
    (sectionMatches.length / Object.keys(SECTION_PATTERNS).length) * 65
  );

  const jd = normalizeText(jobDescription);
  if (!jd) {
    const hasSummary = SECTION_PATTERNS.summary.test(resume);
    const titleScore = hasSummary ? 35 : 20;

    return {
      score: Math.min(100, standardSectionScore + titleScore),
      sectionsDetected: sectionMatches,
      inferredJobTitle: null,
      titleMatch: false,
      titleMatchConfidence: "none",
    };
  }

  // Conservative title comparison: use a short opening JD excerpt.
  const jdTitleCandidates = String(jobDescription)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && line.length <= 90);

  const title = jdTitleCandidates[0] || "";
  const titleTerms = title
    .toLowerCase()
    .match(/\b[a-z][a-z+#.-]{2,}\b/g) || [];

  const usefulTitleTerms = titleTerms.filter(
    (term) => !STOP_WORDS.has(term) && !SKILL_LEXICON.includes(term)
  );

  const titleMatch = usefulTitleTerms.some((term) => hasKeyword(resume, term));
  const titleScore = usefulTitleTerms.length
    ? (titleMatch ? 35 : 15)
    : 20;

  return {
    score: Math.min(100, standardSectionScore + titleScore),
    sectionsDetected: sectionMatches,
    inferredJobTitle: title || null,
    titleMatch,
    titleMatchConfidence: "low",
  };
}

function scoreEducationCertificationsImpact(resume, jobDescription) {
  const jd = normalizeText(jobDescription);

  const degreeRequired = DEGREE_PATTERNS.find((degree) =>
    degree.regex.test(jd)
  );

  const degreePresent = DEGREE_PATTERNS.find((degree) =>
    degree.regex.test(resume)
  );

  const certificationRequired =
    /\b(certification|certified|license|licence|credential|pmp|aws certified)\b/i.test(jd);

  const certificationPresent = SECTION_PATTERNS.certifications.test(resume) ||
    /\b(certified|certification|license|licence|credential)\b/i.test(resume);

  const numbers = countMatches(
    resume,
    /\b\d+(?:\.\d+)?\s*(?:%|percent|users|clients|projects|hours|days|x|k|million|billion)\b/gi
  );

  const actionVerbs = countMatches(
    resume,
    new RegExp(`\\b(?:${ACTION_VERBS.join("|")})\\b`, "gi")
  );

  let score = 0;
  if (degreePresent) score += 35;
  if (!degreeRequired) score += 15;
  else if (degreePresent && degreePresent.level >= degreeRequired.level) score += 15;

  if (certificationPresent) score += 20;
  else if (!certificationRequired) score += 10;

  score += Math.min(20, numbers * 5);
  score += Math.min(10, actionVerbs * 2);

  const hardFilterWarnings = [];

  if (degreeRequired && (!degreePresent || degreePresent.level < degreeRequired.level)) {
    hardFilterWarnings.push({
      type: "degree",
      severity: "review",
      required: degreeRequired.name,
      detected: degreePresent?.name || null,
      message: "The stated degree requirement may not be satisfied. Verify the candidate's actual qualification.",
    });
  }

  if (certificationRequired && !certificationPresent) {
    hardFilterWarnings.push({
      type: "certification",
      severity: "review",
      message: "The job description mentions certification or licensing. Verify whether a specific mandatory credential is missing.",
    });
  }

  return {
    score: Math.min(100, score),
    degreeRequired: degreeRequired?.name || null,
    degreeDetected: degreePresent?.name || null,
    certificationRequired,
    certificationDetected: certificationPresent,
    quantifiedMetrics: numbers,
    actionVerbCount: actionVerbs,
    hardFilterWarnings,
  };
}

function calculateATSScore(text, jobDescription = "", options = {}) {
  const rawResume = String(text || "");
  const rawJD = String(jobDescription || "").trim();
  const pageCount = Number(options?.pageCount || (typeof options === "number" ? options : 1)) || 1;
  const isJobSpecific = Boolean(rawJD);
  const scoreType = isJobSpecific ? "job_specific" : "general";

  if (!rawResume.trim()) {
    return {
      score: 0,
      scoreType,
      pageCount,
      pagePenalty: 0,
      error: "Resume text is empty. Extract the resume text before scoring.",
      breakdown: {},
      componentScores: {},
      matchedKeywords: [],
      missingKeywords: [],
      suggestions: ["Upload a readable resume PDF and verify that text extraction succeeded."],
    };
  }

  const resume = normalizeText(rawResume);
  const keywordResult = scoreKeywords(resume, rawJD);
  const skillsResult = scoreSkills(resume, rawJD, keywordResult);
  const parsingResult = scoreParsingAndFormatting(rawResume);
  const experienceResult = scoreExperience(resume, rawJD);
  const titleResult = scoreTitleAndSections(resume, rawJD);
  const educationResult = scoreEducationCertificationsImpact(resume, rawJD);

  const componentScores = {
    keywordMatch: keywordResult.score,
    skillsCoverage: skillsResult.score,
    parseFormatting: parsingResult.score,
    experienceAlignment: experienceResult.score,
    titleAndSections: titleResult.score,
    educationCertificationsImpact: educationResult.score,
  };

  const weightedBreakdown = Object.fromEntries(
    Object.entries(WEIGHTS).map(([key, weight]) => [
      key,
      Math.round((componentScores[key] || 0) * weight * 100) / 100,
    ])
  );

  let score = Object.values(weightedBreakdown).reduce(
    (total, points) => total + points,
    0
  );

  // If the resume is more than 1 page, deduct score and warn
  let pagePenalty = 0;
  if (pageCount > 1) {
    pagePenalty = Math.min(25, (pageCount - 1) * 10);
    score = Math.max(0, score - pagePenalty);
  }

  const contact = findContactInfo(rawResume);
  const suggestions = [];

  // Page count recommendation placed at the very top
  if (pageCount > 1) {
    suggestions.push(
      `Your resume is ${pageCount} pages long. Try to make it in one page — recruiters and ATS prefer a concise, single-page format.`
    );
  }

  if (!contact.emailFound) {
    suggestions.push("Add a clearly visible email address in the resume header or body.");
  }

  if (!contact.phoneFound) {
    suggestions.push("Add a clearly visible phone number in the resume header or body.");
  }

  if (!contact.linkedinFound) {
    suggestions.push("Consider adding a link to your LinkedIn profile.");
  }

  if (isJobSpecific) {
    for (const kw of keywordResult.missingKeywords.slice(0, 5)) {
      const kwName = typeof kw === "string" ? kw : kw.keyword;
      suggestions.push(`If accurate, incorporate "${kwName}" into a relevant experience, project, or skills section.`);
    }

    if (skillsResult.missingSkills.length) {
      suggestions.push(`Review job-description skills and include those you possess: ${skillsResult.missingSkills.slice(0, 6).join(", ")}.`);
    }
  } else {
    if (skillsResult.missingSkills.length) {
      suggestions.push(`Consider highlighting common industry tools if applicable: ${skillsResult.missingSkills.slice(0, 5).join(", ")}.`);
    }
  }

  if (parsingResult.score < 80) {
    suggestions.push("Check PDF formatting: use standard headings, a simple single-column layout, and selectable text for better parsing.");
  }

  if (experienceResult.hardFilterWarnings.length) {
    suggestions.push("Review experience duration and dates to ensure chronological consistency.");
  }

  if (educationResult.hardFilterWarnings.length) {
    suggestions.push("Verify that degrees and certifications are clearly labelled with graduation years.");
  }

  if (educationResult.quantifiedMetrics < 2) {
    suggestions.push("Where possible, quantify achievements using metrics (e.g. % improvements, users impacted, or project scale).");
  }

  const hardFilterWarnings = [
    ...experienceResult.hardFilterWarnings,
    ...educationResult.hardFilterWarnings,
  ];

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    scoreType,
    pageCount,
    pagePenalty,
    framework: "weighted_ats_proxy_v2",
    weights: WEIGHTS,
    weightedBreakdown,
    componentScores,
    breakdown: {
      keywordMatch: keywordResult.score,
      skillsCoverage: skillsResult.score,
      parseFormatting: parsingResult.score,
      experienceAlignment: experienceResult.score,
      titleAndSections: titleResult.score,
      educationCertificationsImpact: educationResult.score,
      pageCount,
      pagePenalty,
    },
    contactInformation: contact,
    sectionsDetected: titleResult.sectionsDetected,
    inferredJobTitle: titleResult.inferredJobTitle,
    titleMatchConfidence: titleResult.titleMatchConfidence,
    matchedKeywords: keywordResult.matchedKeywords.map((k) => (typeof k === "string" ? k : k.keyword)),
    missingKeywords: keywordResult.missingKeywords.map((k) => (typeof k === "string" ? k : k.keyword)),
    requiredKeywords: keywordResult.requiredKeywords || [],
    matchedSkills: skillsResult.matchedSkills,
    missingSkills: skillsResult.missingSkills,
    parsing: parsingResult,
    experience: experienceResult,
    qualifications: educationResult,
    hardFilterWarnings,
    suggestions: suggestions.slice(0, 15),
    scoreInterpretation:
      score >= 85 ? "Strong match" :
      score >= 70 ? "Competitive match" :
      score >= 55 ? "Needs improvement" :
      "Low match",
    disclaimer: "This is a transparent heuristic, not an actual Workday, Taleo, iCIMS, Lever, or other ATS score. Employer configurations differ. Layout checks and hard requirements require verification.",
  };
}

module.exports = { calculateATSScore };
