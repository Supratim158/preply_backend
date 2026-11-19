const PDFDocument = require("pdfkit");
const parseResume = require("../utils/resumeParser");
const { isValidUrl } = require("./resumeValidator");

/**
 * Render resume data to a PDF buffer using a specific layout configuration
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
          Subject: "ATS Optimized Resume",
        },
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#111827"; // Dark Charcoal
      const secondaryColor = "#374151"; // Gray 700
      const accentColor = "#1D4ED8"; // Professional Blue
      const dividerColor = "#D1D5DB"; // Border Gray

      const contentWidth = 595.28 - config.marginLeft - config.marginRight;

      // ============================================
      // HEADER: NAME & CONTACT
      // ============================================
      const name = (resume.personalDetails?.fullName || "Candidate").toUpperCase();
      doc
        .font("Helvetica-Bold")
        .fontSize(config.nameFontSize)
        .fillColor(primaryColor)
        .text(name, { align: "center" });

      doc.moveDown(0.2);

      // Contact bar (clickable links)
      const contactSpans = [];

      if (resume.personalDetails?.email) {
        contactSpans.push({
          text: resume.personalDetails.email,
          link: `mailto:${resume.personalDetails.email}`,
        });
      }

      if (resume.personalDetails?.phone) {
        const cleanPhone = resume.personalDetails.phone.replace(/[^+\d]/g, "");
        contactSpans.push({
          text: resume.personalDetails.phone,
          link: `tel:${cleanPhone}`,
        });
      }

      if (resume.personalDetails?.location) {
        contactSpans.push({
          text: resume.personalDetails.location,
          link: null,
        });
      }

      if (resume.personalDetails?.linkedin && isValidUrl(resume.personalDetails.linkedin)) {
        contactSpans.push({
          text: "LinkedIn",
          link: resume.personalDetails.linkedin,
        });
      }

      if (resume.personalDetails?.github && isValidUrl(resume.personalDetails.github)) {
        contactSpans.push({
          text: "GitHub",
          link: resume.personalDetails.github,
        });
      }

      if (resume.personalDetails?.portfolio && isValidUrl(resume.personalDetails.portfolio)) {
        contactSpans.push({
          text: "Portfolio",
          link: resume.personalDetails.portfolio,
        });
      }

      if (contactSpans.length > 0) {
        doc.font("Helvetica").fontSize(config.contactFontSize).fillColor(secondaryColor);

        for (let i = 0; i < contactSpans.length; i++) {
          const item = contactSpans[i];
          const isLast = i === contactSpans.length - 1;

          if (item.link) {
            doc.fillColor(accentColor).text(item.text, {
              link: item.link,
              underline: false,
              continued: !isLast,
            });
          } else {
            doc.fillColor(secondaryColor).text(item.text, {
              continued: !isLast,
            });
          }

          if (!isLast) {
            doc.fillColor(dividerColor).text("  |  ", {
              link: null,
              underline: false,
              continued: true,
            });
          }
        }
      }

      doc.moveDown(config.sectionHeaderGap);

      // Helper: Section Header
      const renderSectionHeader = (title) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(config.sectionHeaderFontSize)
          .fillColor(primaryColor)
          .text(title.toUpperCase(), { align: "left" });

        const y = doc.y + 1;
        doc
          .strokeColor(accentColor)
          .lineWidth(1)
          .moveTo(config.marginLeft, y)
          .lineTo(config.marginLeft + contentWidth, y)
          .stroke();

        doc.y = y + config.afterDividerGap;
      };

      // ============================================
      // 1. PROFESSIONAL SUMMARY
      // ============================================
      if (resume.professionalSummary && resume.professionalSummary.trim()) {
        renderSectionHeader("Professional Summary");
        doc
          .font("Helvetica")
          .fontSize(config.bodyFontSize)
          .lineGap(config.bodyLineGap)
          .fillColor(secondaryColor)
          .text(resume.professionalSummary.trim(), {
            align: "justify",
            width: contentWidth,
          });

        doc.moveDown(config.sectionSpacing);
      }

      // ============================================
      // 2. TECHNICAL & SOFT SKILLS
      // ============================================
      const techSkills = resume.skills?.technical || [];
      const softSkills = resume.skills?.soft || [];

      if (techSkills.length > 0 || softSkills.length > 0) {
        renderSectionHeader("Technical Skills");

        if (techSkills.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(config.bodyFontSize)
            .fillColor(primaryColor)
            .text("Technical Skills: ", { continued: true })
            .font("Helvetica")
            .fillColor(secondaryColor)
            .text(techSkills.join(", "));
        }

        if (softSkills.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(config.bodyFontSize)
            .fillColor(primaryColor)
            .text("Soft Skills: ", { continued: true })
            .font("Helvetica")
            .fillColor(secondaryColor)
            .text(softSkills.join(", "));
        }

        doc.moveDown(config.sectionSpacing);
      }

      // ============================================
      // 3. WORK EXPERIENCE
      // ============================================
      const experiences = (resume.experience || []).slice(0, config.maxExperienceItems);
      if (experiences.length > 0) {
        renderSectionHeader("Work Experience");

        experiences.forEach((exp, idx) => {
          const title = exp.jobTitle || "Role";
          const company = exp.company ? ` | ${exp.company}` : "";
          const location = exp.location || "";
          const dates = `${exp.startDate || ""} - ${exp.endDate || (exp.current ? "Present" : "")}`.trim();

          const headerText = `${title}${company}`;
          const dateLocation = [dates, location].filter(Boolean).join("  •  ");

          doc
            .font("Helvetica-Bold")
            .fontSize(config.itemTitleFontSize)
            .fillColor(primaryColor)
            .text(headerText, { continued: !!dateLocation })
            .font("Helvetica-Oblique")
            .fontSize(config.dateFontSize)
            .fillColor(secondaryColor)
            .text(dateLocation ? `   (${dateLocation})` : "", { align: "left" });

          const bullets = (exp.responsibilities || []).slice(0, config.maxBulletsPerItem);
          bullets.forEach((bullet) => {
            doc
              .font("Helvetica")
              .fontSize(config.bodyFontSize)
              .lineGap(config.bulletLineGap)
              .fillColor(secondaryColor)
              .text(`•  ${bullet}`, {
                indent: 10,
                width: contentWidth,
                align: "left",
              });
          });

          if (idx < experiences.length - 1) {
            doc.moveDown(config.itemSpacing);
          }
        });

        doc.moveDown(config.sectionSpacing);
      }

      // ============================================
      // 4. PROJECTS
      // ============================================
      const projects = (resume.projects || []).slice(0, config.maxProjectItems);
      if (projects.length > 0) {
        renderSectionHeader("Key Projects");

        projects.forEach((proj, idx) => {
          const projTitle = proj.title || "Project";
          const techs = (proj.technologies || []).length > 0 ? ` [${proj.technologies.join(", ")}]` : "";

          doc
            .font("Helvetica-Bold")
            .fontSize(config.itemTitleFontSize)
            .fillColor(primaryColor)
            .text(projTitle, { continued: true });

          if (proj.link && isValidUrl(proj.link)) {
            doc
              .fillColor(accentColor)
              .font("Helvetica")
              .text("  (Link)", {
                link: proj.link,
                underline: false,
                continued: true,
              });
          }

          doc
            .font("Helvetica-Oblique")
            .fontSize(config.dateFontSize)
            .fillColor(secondaryColor)
            .text(techs, { align: "left" });

          if (proj.description) {
            doc
              .font("Helvetica")
              .fontSize(config.bodyFontSize)
              .fillColor(secondaryColor)
              .text(proj.description, {
                indent: 10,
                width: contentWidth,
              });
          }

          const highlights = (proj.highlights || []).slice(0, config.maxHighlightsPerProject);
          highlights.forEach((hl) => {
            doc
              .font("Helvetica")
              .fontSize(config.bodyFontSize)
              .lineGap(config.bulletLineGap)
              .fillColor(secondaryColor)
              .text(`•  ${hl}`, {
                indent: 10,
                width: contentWidth,
              });
          });

          if (idx < projects.length - 1) {
            doc.moveDown(config.itemSpacing);
          }
        });

        doc.moveDown(config.sectionSpacing);
      }

      // ============================================
      // 5. EDUCATION
      // ============================================
      const education = (resume.education || []).slice(0, 2);
      if (education.length > 0) {
        renderSectionHeader("Education");

        education.forEach((edu, idx) => {
          const degree = edu.degree || "Degree";
          const institution = edu.institution ? ` | ${edu.institution}` : "";
          const dates = `${edu.startDate || ""} - ${edu.endDate || ""}`.trim();
          const location = edu.location || "";
          const meta = [dates, location].filter(Boolean).join("  •  ");

          doc
            .font("Helvetica-Bold")
            .fontSize(config.itemTitleFontSize)
            .fillColor(primaryColor)
            .text(`${degree}${institution}`, { continued: !!meta })
            .font("Helvetica-Oblique")
            .fontSize(config.dateFontSize)
            .fillColor(secondaryColor)
            .text(meta ? `   (${meta})` : "", { align: "left" });

          if (idx < education.length - 1) {
            doc.moveDown(config.itemSpacing);
          }
        });

        doc.moveDown(config.sectionSpacing);
      }

      // ============================================
      // 6. CERTIFICATIONS (Only if non-empty)
      // ============================================
      const certs = (resume.certifications || []).filter((c) => c.name);
      if (certs.length > 0 && config.includeCertifications) {
        renderSectionHeader("Certifications");

        certs.slice(0, config.maxCertifications).forEach((cert, idx) => {
          doc
            .font("Helvetica-Bold")
            .fontSize(config.bodyFontSize)
            .fillColor(primaryColor)
            .text(`•  ${cert.name}`, { continued: true });

          if (cert.issuer) {
            doc
              .font("Helvetica")
              .fillColor(secondaryColor)
              .text(` - ${cert.issuer}`, { continued: true });
          }

          if (cert.date) {
            doc
              .font("Helvetica-Oblique")
              .fontSize(config.dateFontSize)
              .fillColor(secondaryColor)
              .text(` (${cert.date})`, { continued: !!cert.url });
          }

          if (cert.url && isValidUrl(cert.url)) {
            doc
              .font("Helvetica")
              .fontSize(config.dateFontSize)
              .fillColor(accentColor)
              .text("  [Credential]", {
                link: cert.url,
                underline: false,
              });
          } else {
            doc.text("");
          }

          if (idx < certs.length - 1) {
            doc.moveDown(0.2);
          }
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
 */
const LAYOUT_PROFILES = [
  // 1. Standard Professional
  {
    name: "standard",
    marginTop: 34,
    marginBottom: 34,
    marginLeft: 36,
    marginRight: 36,
    nameFontSize: 18,
    contactFontSize: 9,
    sectionHeaderFontSize: 11,
    itemTitleFontSize: 10,
    bodyFontSize: 9.5,
    dateFontSize: 8.5,
    bodyLineGap: 1.5,
    bulletLineGap: 1.2,
    sectionHeaderGap: 0.3,
    afterDividerGap: 4,
    sectionSpacing: 0.45,
    itemSpacing: 0.3,
    maxExperienceItems: 3,
    maxBulletsPerItem: 3,
    maxProjectItems: 3,
    maxHighlightsPerProject: 2,
    includeCertifications: true,
    maxCertifications: 3,
  },
  // 2. Compact
  {
    name: "compact",
    marginTop: 28,
    marginBottom: 28,
    marginLeft: 30,
    marginRight: 30,
    nameFontSize: 16.5,
    contactFontSize: 8.5,
    sectionHeaderFontSize: 10.5,
    itemTitleFontSize: 9.5,
    bodyFontSize: 9.0,
    dateFontSize: 8.0,
    bodyLineGap: 1.0,
    bulletLineGap: 0.8,
    sectionHeaderGap: 0.25,
    afterDividerGap: 3,
    sectionSpacing: 0.35,
    itemSpacing: 0.25,
    maxExperienceItems: 3,
    maxBulletsPerItem: 2,
    maxProjectItems: 3,
    maxHighlightsPerProject: 2,
    includeCertifications: true,
    maxCertifications: 2,
  },
  // 3. Dense / Ultra-Compact
  {
    name: "dense",
    marginTop: 24,
    marginBottom: 24,
    marginLeft: 26,
    marginRight: 26,
    nameFontSize: 15,
    contactFontSize: 8.0,
    sectionHeaderFontSize: 10.0,
    itemTitleFontSize: 9.0,
    bodyFontSize: 8.5,
    dateFontSize: 7.8,
    bodyLineGap: 0.5,
    bulletLineGap: 0.5,
    sectionHeaderGap: 0.2,
    afterDividerGap: 2.5,
    sectionSpacing: 0.25,
    itemSpacing: 0.2,
    maxExperienceItems: 2,
    maxBulletsPerItem: 2,
    maxProjectItems: 2,
    maxHighlightsPerProject: 1,
    includeCertifications: true,
    maxCertifications: 2,
  },
  // 4. Maximum Fit (Only if previous dense exceeded)
  {
    name: "maximum_fit",
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 24,
    marginRight: 24,
    nameFontSize: 14,
    contactFontSize: 7.8,
    sectionHeaderFontSize: 9.5,
    itemTitleFontSize: 8.5,
    bodyFontSize: 8.0,
    dateFontSize: 7.5,
    bodyLineGap: 0.3,
    bulletLineGap: 0.3,
    sectionHeaderGap: 0.15,
    afterDividerGap: 2,
    sectionSpacing: 0.2,
    itemSpacing: 0.15,
    maxExperienceItems: 2,
    maxBulletsPerItem: 2,
    maxProjectItems: 2,
    maxHighlightsPerProject: 1,
    includeCertifications: false,
    maxCertifications: 0,
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
      // Keep track of the tightest buffer if all fail
      selectedBuffer = buffer;
      finalPageCount = parsed.pageCount;
    }
  }

  // If even maximum_fit produced > 1 page, aggressively condense resume content
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
      highlights: (proj.highlights || []).slice(0, 1),
    }));

    prunedData.certifications = [];

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
