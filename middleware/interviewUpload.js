const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const resumeFilter = (req, file, cb) => {
  const valid =
    file.mimetype === "application/pdf" &&
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!valid) {
    return cb(new Error("Only PDF resumes are allowed."));
  }

  cb(null, true);
};

const audioFilter = (req, file, cb) => {
  const allowed = [
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/flac",
    "video/webm"
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Unsupported audio format."));
  }

  cb(null, true);
};

const resumeUpload = multer({
  storage,
  fileFilter: resumeFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

const audioUpload = multer({
  storage,
  fileFilter: audioFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

module.exports = {
  resumeUpload,
  audioUpload
};