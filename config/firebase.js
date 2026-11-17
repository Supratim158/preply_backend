const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

// Resolve Firebase service account credentials
// Supports:
// 1. FIREBASE_SERVICE_ACCOUNT (raw JSON string in environment variable)
// 2. FIREBASE_SERVICE_ACCOUNT_PATH (custom path in environment variable)
// 3. GOOGLE_APPLICATION_CREDENTIALS (standard GCP/Firebase environment variable)
// 4. /etc/secrets/serviceAccountKey.json (Render Secret File default location)
// 5. /etc/secrets/config/serviceAccountKey.json (Render Secret File nested location)
// 6. ./serviceAccountKey.json (local development in config/ directory)
// 7. ../serviceAccountKey.json (root directory)
const loadServiceAccount = () => {
  // Option 1: Direct JSON string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error(
        "[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string:",
        error.message
      );
    }
  }

  // Candidate file paths
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    "/etc/secrets/serviceAccountKey.json",
    "/etc/secrets/config/serviceAccountKey.json",
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(process.cwd(), "config", "serviceAccountKey.json"),
    path.join(process.cwd(), "serviceAccountKey.json"),
  ].filter(Boolean);

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(fileContent);
        console.log(`[Firebase] Loaded service account credentials from: ${filePath}`);
        return parsed;
      } catch (error) {
        console.error(
          `[Firebase] Error reading service account file at ${filePath}:`,
          error.message
        );
      }
    }
  }

  return null;
};

const serviceAccount = loadServiceAccount();

let app = null;
let messaging = null;

if (serviceAccount) {
  app =
    getApps().length === 0
      ? initializeApp({
          credential: cert(serviceAccount),
        })
      : getApps()[0];

  messaging = getMessaging(app);
} else {
  console.warn(
    "[Firebase] WARNING: No Firebase service account credentials found. " +
      "If deploying to Render, ensure your secret file is named 'serviceAccountKey.json' " +
      "or set FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS to the secret file path. " +
      "Push notifications will be disabled."
  );

  // Fallback messaging object to prevent crashes when sending notifications
  messaging = {
    sendEachForMulticast: async () => {
      console.warn(
        "[Firebase] Skipping push notification delivery: Firebase Admin is not initialized."
      );
      return { responses: [], successCount: 0, failureCount: 0 };
    },
  };
}

module.exports = { app, messaging };
