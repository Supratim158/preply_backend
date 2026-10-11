const User = require('../models/userModel');
const CryptoJs = require('crypto-js');
const jwt = require('jsonwebtoken');
const generateOtp = require('../utils/otpGenerator');
const sendEmail = require('../utils/smtp_function');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = {
    googleLogin: async (req, res) => {
        try {
            const { idToken, email: bodyEmail, name: bodyName, picture: bodyPicture, googleId: bodyGoogleId } = req.body;

            let googleId = bodyGoogleId;
            let email = bodyEmail;
            let name = bodyName;
            let picture = bodyPicture;

            // If idToken and GOOGLE_CLIENT_ID are present, verify with Google
            if (idToken && process.env.GOOGLE_CLIENT_ID) {
                try {
                    const ticket = await googleClient.verifyIdToken({
                        idToken: idToken,
                        audience: process.env.GOOGLE_CLIENT_ID,
                    });
                    const payload = ticket.getPayload();
                    googleId = payload.sub;
                    email = payload.email;
                    name = payload.name;
                    picture = payload.picture;
                } catch (verifyErr) {
                    console.log("Token verification fallback to body data:", verifyErr.message);
                }
            }

            if (!email) {
                return res.status(400).json({ status: false, message: "Email is required for Google login" });
            }

            googleId = googleId || ("google_" + Date.now());
            name = name || email.split("@")[0];

            let user = await User.findOne({
                $or: [{ googleId: googleId }, { email: email.toLowerCase() }]
            });

            if (user) {
                if (user.authProvider === "local") {
                    user.googleId = googleId;
                    user.authProvider = "google";
                    if (picture && !user.profile) user.profile = picture;
                }
            } else {
                user = new User({
                    name: name,
                    email: email.toLowerCase(),
                    userType: "User",
                    authProvider: "google",
                    googleId: googleId,
                    profile: picture || undefined,
                    verification: false,
                    password: CryptoJs.AES.encrypt(
                        googleId + Date.now().toString(),
                        process.env.SECRET
                    ).toString(),
                });
            }

            if (!user.verification) {
                const otp = generateOtp();
                user.otp = otp;
                await user.save();

                try {
                    await sendEmail(user.email, otp);
                } catch (emailErr) {
                    console.error("Email send failed:", emailErr);
                }
            } else {
                await user.save();
            }

            const userToken = jwt.sign(
                {
                    id: user._id,
                    userType: user.userType,
                    email: user.email,
                },
                process.env.JWT_SECRET,
                { expiresIn: "21d" }
            );

            const { password, __v, otp, ...others } = user._doc;
            return res.status(200).json({ ...others, userToken });
        } catch (error) {
            console.error("Google login error:", error);
            return res.status(500).json({ status: false, message: error.message });
        }
    },

    createUser: async (req, res) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

        if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ status: false, message: "Invalid Email" });
        }

        const minPasswordLength = 6;

        if (req.body.password.length < minPasswordLength) {
            return res.status(400).json({ status: false, message: "Password should be at least " + minPasswordLength + " characters" });
        }

        try {
            const emailExists = await User.findOne({ email: req.body.email.toLowerCase() });

            if (emailExists) {
                return res.status(400).json({ status: false, message: "Email already exists" });
            }

            const otp = generateOtp();

            const newUser = new User({
                name: req.body.name,
                userType: "User",
                email: req.body.email.toLowerCase(),
                password: CryptoJs.AES.encrypt(req.body.password, process.env.SECRET).toString(),
                otp: otp,
                verification: false,
            });

            await newUser.save();

            try {
                await sendEmail(newUser.email, otp);
            } catch (emailErr) {
                console.error("Email send failed:", emailErr);
            }

            return res.status(201).json({ status: true, message: "User Created Successfully. Please check your email for OTP." });
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    },

    loginUser: async (req, res) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

        if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ status: false, message: "Invalid Email" });
        }

        const minPasswordLength = 6;

        if (req.body.password.length < minPasswordLength) {
            return res.status(400).json({ status: false, message: "Password should be at least " + minPasswordLength + " characters" });
        }

        try {
            const user = await User.findOne({ email: req.body.email.toLowerCase() });

            if (!user) {
                return res.status(400).json({ status: false, message: "User not found" });
            }

            const decryptedPassword = CryptoJs.AES.decrypt(user.password, process.env.SECRET);
            const depassword = decryptedPassword.toString(CryptoJs.enc.Utf8);

            if (depassword !== req.body.password) {
                return res.status(400).json({ status: false, message: "Wrong Password" });
            }

            const userToken = jwt.sign(
                {
                    id: user._id,
                    userType: user.userType,
                    email: user.email,
                },
                process.env.JWT_SECRET,
                { expiresIn: "21d" }
            );

            const { password, __v, otp, ...others } = user._doc;

            return res.status(200).json({ ...others, userToken });
        } catch (error) {
            return res.status(500).json({ status: false, message: error.message });
        }
    },

    verifyOtp: async (req, res) => {
        try {
            const { email, otp } = req.body;
            if (!email || !otp) {
                return res.status(400).json({ status: false, message: "Email and OTP are required" });
            }

            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ status: false, message: "User not found" });
            }

            if (user.otp !== otp.toString().trim()) {
                return res.status(400).json({ status: false, message: "Invalid OTP code" });
            }

            user.verification = true;
            user.otp = "none";
            await user.save();

            const userToken = jwt.sign(
                {
                    id: user._id,
                    userType: user.userType,
                    email: user.email,
                },
                process.env.JWT_SECRET,
                { expiresIn: "21d" }
            );

            const { password, __v, otp: userOtp, ...others } = user._doc;
            return res.status(200).json({
                status: true,
                message: "OTP verified successfully",
                ...others,
                userToken,
            });
        } catch (error) {
            console.error("Verify OTP error:", error);
            return res.status(500).json({ status: false, message: error.message });
        }
    },

    resendOtp: async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ status: false, message: "Email is required" });
            }

            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ status: false, message: "User not found" });
            }

            const newOtp = generateOtp();
            user.otp = newOtp;
            await user.save();

            try {
                await sendEmail(user.email, newOtp);
            } catch (emailErr) {
                console.error("Email send failed:", emailErr);
            }

            return res.status(200).json({ status: true, message: "New OTP sent to your email" });
        } catch (error) {
            console.error("Resend OTP error:", error);
            return res.status(500).json({ status: false, message: error.message });
        }
    },

    changePassword: async (req, res) => {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    status: false,
                    message: "All fields are required"
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    status: false,
                    message: "New password must be at least 6 characters"
                });
            }

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: "User not found"
                });
            }

            const decryptedPassword = CryptoJs.AES.decrypt(
                user.password,
                process.env.SECRET
            );

            const oldPassword = decryptedPassword.toString(CryptoJs.enc.Utf8);

            if (oldPassword !== currentPassword) {
                return res.status(400).json({
                    status: false,
                    message: "Current password is incorrect"
                });
            }

            const encryptedNewPassword = CryptoJs.AES.encrypt(
                newPassword,
                process.env.SECRET
            ).toString();

            user.password = encryptedNewPassword;
            await user.save();

            return res.status(200).json({
                status: true,
                message: "Password updated successfully"
            });
        } catch (error) {
            return res.status(500).json({
                status: false,
                message: error.message
            });
        }
    }
};
