
const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadResume");

const {
    verifyTokenAndAuthorization
} = require("../middleware/verifyToken");

const {
    analyzeResume,
    getATSHistory,
    getATSResult
} = require("../controllers/atsController");

// Analyze new resume
router.post(
    "/analyze",
    verifyTokenAndAuthorization,
    upload.single("resume"),
    analyzeResume
);

// Get all previous analyses
router.get(
    "/history",
    verifyTokenAndAuthorization,
    getATSHistory
);

// Get one previous analysis
router.get(
    "/result/:id",
    verifyTokenAndAuthorization,
    getATSResult
);

module.exports = router;
