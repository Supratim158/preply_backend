const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, trim: true, unique: true, lowercase: true },
    password: {
        type: String, required: function () {
            return this.authProvider === "local";
        }
    },
    otp: { type: String, required: false, default: "none" },
    verification: { type: Boolean, default: false },
    userType: { type: String, required: true, default: "User", enum: ['User', 'Admin'] },
    profile: { type: String, default: "https://res.cloudinary.com/dwv7t8jvx/image/upload/v1771443605/profilepic_hh9twv.jpg" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, default: null },
    education: [{
        degree: String,
        institution: String,
        fieldOfStudy: String,
        startYear: Number,
        endYear: Number,
    }],
    experience: [{
        company: String,
        role: String,
        startDate: Number,
        endDate: Number,
        description: String,
    }],
    skills: { type: String, trim: true },

    fcmTokens: {
        type: [String],
        default: [],
    },
},
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("user", userSchema);