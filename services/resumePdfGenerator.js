const PDFDocument = require("pdfkit");
const parseResume = require("../utils/resumeParser");
const { isValidUrl } = require("./resumeValidator");

/**
 * Render resume data to a PDF buffer using a specific layout configuration
 * Formatted exactly like the provided reference resume:
 * - Serif font family (Times-Roman, Times-Bold, Times-Italic)
 * - 100% black text for ALL content including links (NO blue text)
 * - Centered header with Name, Location, and Contact/Link bar
 * - Section order: Summary -> Education -> Skills -> Internships/Work Experience -> Projects -> Certifications -> Achievements
 * - Section headers with thin black underline spanning full width
 * - Two-column aligned sub-headers (Title on left, Dates on right; Degree/Role on left, Location on right)
 * - All content in crisp bullet points
 */
const renderPdfWithConfig = (resume, config) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4", // 595.28 x 841.89 points
        margins: {
          top: config.marginTop,
          bottom: config.marginBottom,
          left: config.marginLeft,
          right: config.marginRight,
        },
        info: {
          Title: `${resume.personalDetails?.fullName || "Candidate"} - Resume`,
          Author: resume.personalDetails?.fullName || "Candidate",
          Subject: "ATS Optimized Single-Page Resume",
        },
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // STRICT REQUIREMENT: Pure black for all text and lines (no blue)
      const blackColor = "#000000";
      const contentWidth = 595.28 - config.marginLeft - config.marginRight;

      // Helper: Left and Right on same baseline
      const renderTwoColumnLine = (
        leftText,
        rightText,
        leftFont = "Times-Bold",
        rightFont = "Times-Roman",
        fontSize = config.itemTitleFontSize,
        leftLink = null
      ) => {
        const y = doc.y;
        doc.font(leftFont).fontSize(fontSize).fillColor(blackColor);
        const rightWidth = rightText ? doc.widthOfString(rightText) + 8 : 0;
        const leftWidth = Math.max(50, contentWidth - rightWidth - 6);

        if (leftLink && isValidUrl(leftLink)) {
          doc.text(leftText, config.marginLeft, y, {
            width: leftWidth,
            align: "left",
            lineBreak: false,
            link: leftLink,
            underline: false,
          });
        } else {
          doc.text(leftText, config.marginLeft, y, {
            width: leftWidth,
            align: "left",
            lineBreak: false,
          });
        }

        if (rightText) {
          doc.font(rightFont).fontSize(fontSize).fillColor(blackColor);
          doc.text(rightText, config.marginLeft, y, {
            width: contentWidth,
            align: "right",
            lineBreak: false,
          });
        }

        doc.y = y + doc.currentLineHeight() + config.lineSpacing;
      };

      // Helper: Section Header with horizontal rule
      const renderSectionHeader = (title) => {
        doc.y += config.beforeSectionGap;
        doc
          .font("Times-Bold")
          .fontSize(config.sectionHeaderFontSize)
          .fillColor(blackColor)
          .text(title, config.marginLeft, doc.y, { align: "left" });

        const yLine = doc.y + 1;
        doc
          .strokeColor(blackColor)
          .lineWidth(0.6)
          .moveTo(config.marginLeft, yLine)
          .lineTo(config.marginLeft + contentWidth, yLine)
          .stroke();

        doc.y = yLine + config.afterDividerGap;
      };

      // ============================================
      // HEADER: NAME & CONTACT
      // ============================================
      const name = (resume.personalDetails?.fullName || "Candidate").toUpperCase();
      doc
        .font("Times-Bold")
        .fontSize(config.nameFontSize)
        .fillColor(blackColor)
        .text(name, { align: "center" });

      if (resume.personalDetails?.location) {
        doc.moveDown(0.12);
        doc
          .font("Times-Roman")
          .fontSize(config.contactFontSize)
          .fillColor(blackColor)
          .text(resume.personalDetails.location, { align: "center" });
      }

      // Contact row: Phone | Email | LinkedIn | GitHub | Portfolio
      const contactItems = [];
      if (resume.personalDetails?.phone) {
        contactItems.push({
          text: resume.personalDetails.phone,
          link: `tel:${resume.personalDetails.phone.replace(/[^+\d]/g, "")}`,
        });
      }
      if (resume.personalDetails?.email) {
        contactItems.push({
          text: resume.personalDetails.email,
          link: `mailto:${resume.personalDetails.email}`,
        });
      }
      if (resume.personalDetails?.linkedin && isValidUrl(resume.personalDetails.linkedin)) {
        contactItems.push({
          text: "LinkedIn",
          link: resume.personalDetails.linkedin,
        });
      }
      if (resume.personalDetails?.github && isValidUrl(resume.personalDetails.github)) {
        contactItems.push({
          text: "GitHub",
          link: resume.personalDetails.github,
        });
      }
      if (resume.personalDetails?.portfolio && isValidUrl(resume.personalDetails.portfolio)) {
        contactItems.push({
          text: "Portfolio",
          link: resume.personalDetails.portfolio,
        });
      }

      if (contactItems.length > 0) {
        doc.font("Times-Roman").fontSize(config.contactFontSize);
        const separator = "   •   ";
        const sepWidth = doc.widthOfString(separator);

        let totalWidth = 0;
        for (let i = 0; i < contactItems.length; i++) {
          totalWidth += doc.widthOfString(contactItems[i].text);
          if (i < contactItems.length - 1) {
            totalWidth += sepWidth;
          }
        }

        let currentX = config.marginLeft + (contentWidth - totalWidth) / 2;
        const y = doc.y + 3;

        for (let i = 0; i < contactItems.length; i++) {
          const item = contactItems[i];
          const itemWidth = doc.widthOfString(item.text);

          if (item.link) {
            doc.fillColor(blackColor).text(item.text, currentX, y, {
              link: item.link,
              underline: false,
              lineBreak: false,
            });
          } else {
            doc.fillColor(blackColor).text(item.text, currentX, y, {
              lineBreak: false,
            });
          }

          currentX += itemWidth;

          if (i < contactItems.length - 1) {
            doc.fillColor(blackColor).text(separator, currentX, y, {
              lineBreak: false,
            });
            currentX += sepWidth;
          }
        }

        doc.y = y + doc.currentLineHeight() + 3;
      }

      // ============================================
      // 1. SUMMARY
      // ============================================
      if (resume.professionalSummary && resume.professionalSummary.trim()) {
        renderSectionHeader("Summary");
        doc
          .font("Times-Roman")
          .fontSize(config.bodyFontSize)
          .lineGap(config.bodyLineGap)
          .fillColor(blackColor)
          .text(resume.professionalSummary.trim(), config.marginLeft, doc.y, {
            align: "justify",
            width: contentWidth,
          });
      }

      // ============================================
      // 2. EDUCATION
      // ============================================
      const educationList = (resume.education || []).slice(0, config.maxEducationItems);
      if (educationList.length > 0) {
        renderSectionHeader("Education");
        educationList.forEach((edu) => {
          const dates = `${edu.startDate || ""} - ${edu.endDate || ""}`.trim();
          renderTwoColumnLine(
            edu.institution || "Institution",
            dates,
            "Times-Bold",
            "Times-Roman",
            config.itemTitleFontSize
          );

          const degreeGrade = [edu.degree, edu.grade].filter(Boolean).join(", ");
          renderTwoColumnLine(
            degreeGrade,
            edu.location || "",
            "Times-Italic",
            "Times-Italic",
            config.subItemFontSize
          );
        });
      }

      // ============================================
      // 3. SKILLS
      // ============================================
      const skills = resume.skills || {};
      const hasCategorizedSkills =
        (skills.languages && skills.languages.length > 0) ||
        (skills.frameworks && skills.frameworks.length > 0) ||
        (skills.developerTools && skills.developerTools.length > 0) ||
        (skills.coreSkills && skills.coreSkills.length > 0);

      if (hasCategorizedSkills || (skills.technical && skills.technical.length > 0) || (skills.soft && skills.soft.length > 0)) {
        renderSectionHeader("Skills");

        const skillLines = [];
        if (skills.languages?.length) {
          skillLines.push({ label: "Languages:", list: skills.languages.join(", ") });
        }
        if (skills.frameworks?.length) {
          skillLines.push({ label: "Frameworks/Technologies:", list: skills.frameworks.join(", ") });
        }
        if (skills.developerTools?.length) {
          skillLines.push({ label: "Developer Tools:", list: skills.developerTools.join(", ") });
        }
        if (skills.coreSkills?.length) {
          skillLines.push({ label: "Core Skills:", list: skills.coreSkills.join(", ") });
        }

        if (skillLines.length === 0) {
          if (skills.technical?.length) {
            skillLines.push({ label: "Technical Skills:", list: skills.technical.join(", ") });
          }
          if (skills.soft?.length) {
            skillLines.push({ label: "Core Skills / Soft Skills:", list: skills.soft.join(", ") });
          }
        }

        skillLines.forEach((sk) => {
          doc
            .font("Times-Bold")
            .fontSize(config.bodyFontSize)
            .fillColor(blackColor)
            .text(sk.label + " ", config.marginLeft, doc.y, { continued: true })
            .font("Times-Roman")
            .fillColor(blackColor)
            .text(sk.list, { align: "left" });
          doc.y += config.lineSpacing;
        });
      }

      // ============================================
      // 4. INTERNSHIPS / WORK EXPERIENCE
      // ============================================
      const experiences = (resume.experience || []).slice(0, config.maxExperienceItems);
      if (experiences.length > 0) {
        const isInternship = experiences.every((e) =>
          /intern/i.test(e.jobTitle || "") || /intern/i.test(e.company || "")
        );
        renderSectionHeader(isInternship ? "Internships" : "Work Experience");

        experiences.forEach((exp) => {
          const dates = `${exp.startDate || ""} - ${exp.endDate || (exp.current ? "Present" : "")}`.trim();
          renderTwoColumnLine(
            exp.jobTitle || "Role",
            dates,
            "Times-Bold",
            "Times-Roman",
            config.itemTitleFontSize
          );

          if (exp.roleType || exp.location || exp.company) {
            const subTitle = exp.roleType || exp.company || "";
            renderTwoColumnLine(
              subTitle,
              exp.location || "",
              "Times-Italic",
              "Times-Italic",
              config.subItemFontSize
            );
          }

          const bullets = (exp.responsibilities || []).slice(0, config.maxBulletsPerItem);
          bullets.forEach((resp) => {
            doc
              .font("Times-Roman")
              .fontSize(config.bulletFontSize)
              .lineGap(config.bulletLineGap)
              .fillColor(blackColor)
              .text(`–  ${resp}`, config.marginLeft + 8, doc.y, {
                width: contentWidth - 8,
                align: "left",
              });
          });
          doc.y += config.itemSpacing;
        });
      }

      // ============================================
      // 5. PROJECTS
      // ============================================
      const projects = (resume.projects || []).slice(0, config.maxProjectItems);
      if (projects.length > 0) {
        renderSectionHeader("Projects");

        projects.forEach((proj) => {
          let rawTechs = proj.technologies;
          if (typeof rawTechs === "string") {
            rawTechs = rawTechs.split(",").map((t) => t.trim()).filter(Boolean);
          } else if (!Array.isArray(rawTechs)) {
            rawTechs = [];
          }
          // Only show top 2-3 main core technologies beside the title (e.g. Flutter, Node.js, MongoDB)
          const coreTechs = rawTechs.slice(0, 3).join(", ");
          const techs = coreTechs.length > 0 ? ` | ${coreTechs}` : "";
          const dates = `${proj.startDate || ""} - ${proj.endDate || ""}`.trim();
          const leftProj = `${proj.title || "Project"}${techs}`;

          renderTwoColumnLine(
            leftProj,
            dates,
            "Times-Bold",
            "Times-Roman",
            config.itemTitleFontSize,
            proj.link
          );

          const highlights = (proj.highlights || []).slice(0, config.maxHighlightsPerProject);
          highlights.forEach((hl) => {
            doc
              .font("Times-Roman")
              .fontSize(config.bulletFontSize)
              .lineGap(config.bulletLineGap)
              .fillColor(blackColor)
              .text(`–  ${hl}`, config.marginLeft + 8, doc.y, {
                width: contentWidth - 8,
                align: "left",
              });
          });
          doc.y += config.itemSpacing;
        });
      }

      // ============================================
      // 6. CERTIFICATIONS
      // ============================================
      const certs = (resume.certifications || []).filter((c) => c.name).slice(0, config.maxCertifications);
      if (certs.length > 0 && config.includeCertifications) {
        renderSectionHeader("Certifications");
        const certStrings = certs.map((c) => {
          const parts = [c.name];
          if (c.issuer) parts.push(c.issuer);
          if (c.date) parts.push(`(${c.date})`);
          return parts.join(" – ");
        });

        const singleLine = certStrings.join("   —   ");
        doc.font("Times-Roman").fontSize(config.bodyFontSize).fillColor(blackColor);

        if (doc.widthOfString(singleLine) <= contentWidth) {
          doc.text(singleLine, config.marginLeft, doc.y, { align: "left" });
        } else {
          certStrings.forEach((cs) => {
            doc.text(`•  ${cs}`, config.marginLeft + 8, doc.y, {
              width: contentWidth - 8,
              align: "left",
            });
          });
        }
      }

      // ============================================
      // 7. ACHIEVEMENTS
      // ============================================
      const achievements = (resume.achievements || []).slice(0, config.maxAchievements);
      if (achievements.length > 0 && config.includeAchievements) {
        renderSectionHeader("Achievements");
        achievements.forEach((ach) => {
          doc
            .font("Times-Roman")
            .fontSize(config.bulletFontSize)
            .lineGap(config.bulletLineGap)
            .fillColor(blackColor)
            .text(`•  ${ach}`, config.marginLeft + 8, doc.y, {
              width: contentWidth - 8,
              align: "left",
            });
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Layout profiles ordered from Standard to Ultra-Compact
 * Carefully calibrated to guarantee exact single A4 page fit
 */
const LAYOUT_PROFILES = [
  // 1. Standard (Default match to image)
  {
    name: "standard",
    marginTop: 22,
    marginBottom: 20,
    marginLeft: 32,
    marginRight: 32,
    nameFontSize: 20,
    contactFontSize: 8.5,
    sectionHeaderFontSize: 11,
    itemTitleFontSize: 9.5,
    subItemFontSize: 8.5,
    bodyFontSize: 8.5,
    bulletFontSize: 8.3,
    bodyLineGap: 0.8,
    bulletLineGap: 0.5,
    lineSpacing: 1.2,
    afterDividerGap: 2.5,
    beforeSectionGap: 3,
    itemSpacing: 2,
    maxEducationItems: 3,
    maxExperienceItems: 2,
    maxBulletsPerItem: 3,
    maxProjectItems: 3,
    maxHighlightsPerProject: 3,
    includeCertifications: true,
    maxCertifications: 2,
    includeAchievements: true,
    maxAchievements: 2,
  },
  // 2. Compact
  {
    name: "compact",
    marginTop: 20,
    marginBottom: 18,
    marginLeft: 28,
    marginRight: 28,
    nameFontSize: 18,
    contactFontSize: 8.0,
    sectionHeaderFontSize: 10.5,
    itemTitleFontSize: 9.0,
    subItemFontSize: 8.0,
    bodyFontSize: 8.0,
    bulletFontSize: 7.8,
    bodyLineGap: 0.6,
    bulletLineGap: 0.4,
    lineSpacing: 1.0,
    afterDividerGap: 2.0,
    beforeSectionGap: 2.5,
    itemSpacing: 1.8,
    maxEducationItems: 3,
    maxExperienceItems: 2,
    maxBulletsPerItem: 3,
    maxProjectItems: 3,
    maxHighlightsPerProject: 2,
    includeCertifications: true,
    maxCertifications: 2,
    includeAchievements: true,
    maxAchievements: 2,
  },
  // 3. Dense
  {
    name: "dense",
    marginTop: 18,
    marginBottom: 16,
    marginLeft: 26,
    marginRight: 26,
    nameFontSize: 16.5,
    contactFontSize: 7.8,
    sectionHeaderFontSize: 10.0,
    itemTitleFontSize: 8.5,
    subItemFontSize: 7.8,
    bodyFontSize: 7.8,
    bulletFontSize: 7.5,
    bodyLineGap: 0.4,
    bulletLineGap: 0.3,
    lineSpacing: 0.8,
    afterDividerGap: 1.8,
    beforeSectionGap: 2.0,
    itemSpacing: 1.5,
    maxEducationItems: 3,
    maxExperienceItems: 2,
    maxBulletsPerItem: 2,
    maxProjectItems: 2,
    maxHighlightsPerProject: 2,
    includeCertifications: true,
    maxCertifications: 2,
    includeAchievements: true,
    maxAchievements: 2,
  },
  // 4. Maximum Fit (Ensures even huge text fits on 1 page)
  {
    name: "maximum_fit",
    marginTop: 16,
    marginBottom: 14,
    marginLeft: 24,
    marginRight: 24,
    nameFontSize: 15,
    contactFontSize: 7.5,
    sectionHeaderFontSize: 9.5,
    itemTitleFontSize: 8.0,
    subItemFontSize: 7.5,
    bodyFontSize: 7.5,
    bulletFontSize: 7.2,
    bodyLineGap: 0.3,
    bulletLineGap: 0.2,
    lineSpacing: 0.6,
    afterDividerGap: 1.5,
    beforeSectionGap: 1.5,
    itemSpacing: 1.2,
    maxEducationItems: 2,
    maxExperienceItems: 2,
    maxBulletsPerItem: 2,
    maxProjectItems: 2,
    maxHighlightsPerProject: 2,
    includeCertifications: true,
    maxCertifications: 1,
    includeAchievements: true,
    maxAchievements: 1,
  },
];

/**
 * Generate a guaranteed single-page PDF with layout validation
 */
const generateOnePageResumePdf = async (resumeData) => {
  let selectedBuffer = null;
  let finalPageCount = 999;
  let usedProfile = null;

  for (const profile of LAYOUT_PROFILES) {
    const buffer = await renderPdfWithConfig(resumeData, profile);
    const parsed = await parseResume(buffer);

    if (parsed.pageCount === 1) {
      selectedBuffer = buffer;
      finalPageCount = 1;
      usedProfile = profile.name;
      break;
    } else {
      selectedBuffer = buffer;
      finalPageCount = parsed.pageCount;
    }
  }

  // If even maximum_fit produced > 1 page, prune content to strictly guarantee 1 page
  if (finalPageCount > 1) {
    console.warn(`Resume overflowed to ${finalPageCount} pages. Applying content pruning...`);
    const prunedData = JSON.parse(JSON.stringify(resumeData));

    // Truncate summary to 2 sentences
    if (prunedData.professionalSummary) {
      const sentences = prunedData.professionalSummary.match(/[^.!?]+[.!?]+/g) || [prunedData.professionalSummary];
      prunedData.professionalSummary = sentences.slice(0, 2).join(" ");
    }

    // Limit experience and projects
    prunedData.experience = (prunedData.experience || []).slice(0, 2).map((exp) => ({
      ...exp,
      responsibilities: (exp.responsibilities || []).slice(0, 2),
    }));

    prunedData.projects = (prunedData.projects || []).slice(0, 2).map((proj) => ({
      ...proj,
      highlights: (proj.highlights || []).slice(0, 2),
    }));

    prunedData.education = (prunedData.education || []).slice(0, 2);
    prunedData.achievements = (prunedData.achievements || []).slice(0, 2);

    // Re-render with dense profile
    selectedBuffer = await renderPdfWithConfig(prunedData, LAYOUT_PROFILES[2]);
    const rechecked = await parseResume(selectedBuffer);
    finalPageCount = rechecked.pageCount;
    usedProfile = "pruned_dense";
  }

  return {
    pdfBuffer: selectedBuffer,
    pageCount: finalPageCount,
    pageSize: "A4",
    isValid: finalPageCount === 1,
    profileUsed: usedProfile,
  };
};

module.exports = {
  renderPdfWithConfig,
  generateOnePageResumePdf,
};
