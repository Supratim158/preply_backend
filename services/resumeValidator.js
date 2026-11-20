/**
 * Resume JSON schema validator and sanitizer
 */

const isValidUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && parsed.hostname.includes(".");
  } catch (err) {
    return false;
  }
};

const normalizeUrl = (url) => {
  if (!isValidUrl(url)) return "";
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const validateAndSanitizeResume = (resumeData, fallbackData = {}) => {
  if (!resumeData || typeof resumeData !== "object") {
    throw new Error("Generated resume data must be a valid JSON object");
  }

  // Handle categorized skills or legacy skills
  const skillsObj = resumeData.skills || {};
  const languages = Array.isArray(skillsObj.languages)
    ? skillsObj.languages.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const frameworks = Array.isArray(skillsObj.frameworks || skillsObj.technologies)
    ? (skillsObj.frameworks || skillsObj.technologies).map((s) => String(s).trim()).filter(Boolean)
    : [];
  const developerTools = Array.isArray(skillsObj.developerTools || skillsObj.tools)
    ? (skillsObj.developerTools || skillsObj.tools).map((s) => String(s).trim()).filter(Boolean)
    : [];
  const coreSkills = Array.isArray(skillsObj.coreSkills)
    ? skillsObj.coreSkills.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const technical = Array.isArray(skillsObj.technical)
    ? skillsObj.technical.map((s) => String(s).trim()).filter(Boolean)
    : [...languages, ...frameworks, ...developerTools];
  const soft = Array.isArray(skillsObj.soft)
    ? skillsObj.soft.map((s) => String(s).trim()).filter(Boolean)
    : [...coreSkills];

  const sanitized = {
    personalDetails: {
      fullName: (resumeData.personalDetails?.fullName || fallbackData.fullName || "Candidate").trim(),
      email: (resumeData.personalDetails?.email || fallbackData.email || "").trim(),
      phone: (resumeData.personalDetails?.phone || fallbackData.phone || "").trim(),
      location: (resumeData.personalDetails?.location || fallbackData.location || "").trim(),
      linkedin: normalizeUrl(resumeData.personalDetails?.linkedin || fallbackData.linkedin || ""),
      github: normalizeUrl(resumeData.personalDetails?.github || fallbackData.github || ""),
      portfolio: normalizeUrl(resumeData.personalDetails?.portfolio || fallbackData.portfolio || ""),
    },
    professionalSummary: (resumeData.professionalSummary || "").trim(),
    education: Array.isArray(resumeData.education)
      ? resumeData.education
          .map((edu) => ({
            institution: (edu.institution || "").trim(),
            degree: (edu.degree || "").trim(),
            grade: (edu.grade || edu.cgpa || edu.percentage || "").trim(),
            location: (edu.location || "").trim(),
            startDate: (edu.startDate || "").trim(),
            endDate: (edu.endDate || "").trim(),
          }))
          .filter((edu) => edu.institution || edu.degree)
      : [],
    skills: {
      languages,
      frameworks,
      developerTools,
      coreSkills,
      technical,
      soft,
    },
    experience: Array.isArray(resumeData.experience)
      ? resumeData.experience
          .map((exp) => ({
            jobTitle: (exp.jobTitle || "").trim(),
            company: (exp.company || "").trim(),
            roleType: (exp.roleType || "").trim(),
            location: (exp.location || "").trim(),
            startDate: (exp.startDate || "").trim(),
            endDate: (exp.endDate || (exp.current ? "Present" : "")).trim(),
            current: Boolean(exp.current),
            responsibilities: Array.isArray(exp.responsibilities)
              ? exp.responsibilities.map((r) => String(r).trim()).filter(Boolean)
              : [],
          }))
          .filter((exp) => exp.jobTitle || exp.company)
      : [],
    projects: Array.isArray(resumeData.projects)
      ? resumeData.projects
          .map((proj) => ({
            title: (proj.title || "").trim(),
            description: (proj.description || "").trim(),
            technologies: Array.isArray(proj.technologies)
              ? proj.technologies.map((t) => String(t).trim()).filter(Boolean)
              : typeof proj.technologies === "string"
              ? proj.technologies.split(",").map((t) => t.trim()).filter(Boolean)
              : [],
            startDate: (proj.startDate || "").trim(),
            endDate: (proj.endDate || "").trim(),
            link: normalizeUrl(proj.link || ""),
            highlights: Array.isArray(proj.highlights)
              ? proj.highlights.map((h) => String(h).trim()).filter(Boolean)
              : [],
          }))
          .filter((proj) => proj.title)
      : [],
    certifications: Array.isArray(resumeData.certifications)
      ? resumeData.certifications
          .map((cert) => ({
            name: (cert.name || "").trim(),
            issuer: (cert.issuer || "").trim(),
            date: (cert.date || "").trim(),
            url: normalizeUrl(cert.url || ""),
          }))
          .filter((cert) => cert.name)
      : [],
    achievements: Array.isArray(resumeData.achievements)
      ? resumeData.achievements.map((a) => String(a).trim()).filter(Boolean)
      : [],
  };

  return sanitized;
};

module.exports = {
  isValidUrl,
  normalizeUrl,
  validateAndSanitizeResume,
};
