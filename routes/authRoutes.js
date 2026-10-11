const router = require('express').Router();
const authController = require("../controllers/authController");
const { verifyTokenAndAuthorization } = require('../middleware/verifyToken');

router.post("/register", authController.createUser);
router.post("/login", authController.loginUser);
router.post("/google-login", authController.googleLogin);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.put("/change-password", verifyTokenAndAuthorization, authController.changePassword);

module.exports = router;
