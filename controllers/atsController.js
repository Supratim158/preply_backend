const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const ATSResume = require("../models/resumeModel");
const parseResume = require("../utils/resumeParser");
const {
    analyzeLinks,
    calculateATSScore,
    evaluateResumeATS,
} = require("../services/atsScoringService");

// ============================================
// GET AUTHENTICATED USER ID
// ============================================
const getAuthenticatedUserId = (req) => {
    const userId =
        req.user?._id ||
        req.user?.id ||
        req.user?.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
    }

    return new mongoose.Types.ObjectId(userId);
};

// ============================================
// UPLOAD RESUME TO CLOUDINARY
// ============================================
const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const publicId = `${Date.now()}-${filename
            .replace(/\.pdf$/i, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")}`;

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "preply/resumes",
                resource_type: "raw",
                public_id: publicId,
                format: "pdf",
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            }
        );

        stream.end(buffer);
    });
};

// ============================================
// 1. ANALYZE AND UPLOAD RESUME
// ============================================
exports.analyzeResume = async (req, res) => {
    let cloudResult = null;

    try {
        // Get authenticated user
        const userId = getAuthenticatedUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid user authentication",
            });
        }

        const {
            targetRole,
            jobDescription = "",
        } = req.body;

        // Validate PDF
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload your resume PDF",
            });
        }

        // Validate role
        if (!targetRole || !targetRole.trim()) {
            return res.status(400).json({
                success: false,
                message: "Target job role is required",
            });
        }

        // Validate file
        if (
            req.file.mimetype !== "application/pdf" ||
            !req.file.originalname.toLowerCase().endsWith(".pdf")
        ) {
            return res.status(400).json({
                success: false,
                message: "Only PDF resumes are supported",
            });
        }

        // ========================================
        // STEP 1 & 2: PARSE PDF & EVALUATE WITH ATS
        // Uses the unified, advanced ATS scoring service
        // ========================================
        const parsed = await parseResume(req.file.buffer);

        if (!parsed.text || parsed.text.length < 50) {
            return res.status(400).json({
                success: false,
                message: "Unable to extract sufficient resume text",
            });
        }

        const atsResult = await evaluateResumeATS({
            parsedData: parsed,
            targetRole: targetRole.trim(),
            jobDescription: jobDescription.trim(),
        });

        const ai = atsResult.ai;
        const links = atsResult.links;

        // ========================================
        // STEP 3: UPLOAD TO CLOUDINARY
        // ========================================
        cloudResult = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname
        );

        // ========================================
        // STEP 4: SAVE TO MONGODB
        // ========================================
        const analysis = await ATSResume.create({
            userId,
            originalName: req.file.originalname,
            resumeUrl: cloudResult.secure_url,
            publicId: cloudResult.public_id,
            targetRole: targetRole.trim(),
            jobDescription: jobDescription.trim(),
            pageCount: parsed.pageCount,
            atsScore: atsResult.atsScore,
            scoreBreakdown: atsResult.scoreBreakdown,
            links,
            strengths: ai.strengths || [],
            weaknesses: ai.weaknesses || [],
            matchedKeywords: ai.matchedKeywords || [],
            missingKeywords: ai.missingKeywords || [],
            missingSkills: ai.missingSkills || [],
            jobMatch: ai.jobMatch || {},
            suggestions: ai.suggestions || [],
            sectionsDetected: ai.sectionsDetected || [],
            status: "completed",
        });

        // ========================================
        // STEP 5: RETURN COMPLETE ANALYSIS
        // ========================================
        return res.status(201).json({
            success: true,
            message: "Resume analyzed successfully",
            data: analysis,
            usage: atsResult.usage || null,
        });

    } catch (error) {
        console.error("ATS Analysis Error:", error);

        // Delete Cloudinary upload if DB save fails
        if (cloudResult?.public_id) {
            try {
                await cloudinary.uploader.destroy(
                    cloudResult.public_id,
                    { resource_type: "raw" }
                );
            } catch (deleteError) {
                console.error(
                    "Cloudinary cleanup error:",
                    deleteError.message
                );
            }
        }

        return res.status(500).json({
            success: false,
            message: "Resume analysis failed",
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined,
        });
    }
};

// ============================================
// 2. GET PREVIOUS ATS ANALYSIS HISTORY
// ============================================
exports.getATSHistory = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid user authentication",
            });
        }

        const history = await ATSResume.find({
            userId,
            status: "completed",
        })
        .select("-jobDescription")
        .sort({ createdAt: -1 })
        .lean();

        return res.status(200).json({
            success: true,
            message: "ATS history fetched successfully",
            count: history.length,
            data: history,
        });

    } catch (error) {
        console.error("ATS History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch ATS history",
        });
    }
};

// ============================================
// 3. GET PARTICULAR PREVIOUS ATS ANALYSIS
// ============================================
exports.getATSResult = async (req, res) => {
    try {
        const userId = getAuthenticatedUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid user authentication",
            });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ATS analysis ID",
            });
        }

        const analysis = await ATSResume.findOne({
            _id: id,
            userId,
        });

        if (!analysis) {
            return res.status(404).json({
                success: false,
                message: "ATS analysis not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "ATS result fetched successfully",
            data: analysis,
        });

    } catch (error) {
        console.error("ATS Result Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch ATS result",
        });
    }
};
