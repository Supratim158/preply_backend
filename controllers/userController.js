const User = require('../models/userModel');

module.exports = {
    getUser: async (req, res) => {
        try {
            const userId = req.user.id;

            const user = await User.findById(userId)
                .select("-password -otp -__v");

            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: "User not found"
                });
            }

            return res.status(200).json({
                status: true,
                user
            });

        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "Internal server error"
            });
        }
    },

    deleteUser: async (req, res) => {
        try {
            const user = await User.findByIdAndDelete(req.user.id);

            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: "User not found"
                });
            }

            return res.status(200).json({
                status: true,
                message: "User successfully deleted"
            });

        } catch (error) {
            return res.status(500).json({
                status: false,
                message: "Internal server error"
            });
        }
    },


    updateProfile: async (req, res) => {
        try {
            const {
                name,
                email,
                profile,
                education,
                experience,
                skills
            } = req.body || {};

            const userId = req.user.id;

            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    status: false,
                    message: "User not found"
                });
            }

            // 1. Update name
            if (name !== undefined) {
                if (typeof name !== "string" || !name.trim()) {
                    return res.status(400).json({
                        status: false,
                        message: "Name cannot be empty"
                    });
                }

                user.name = name.trim();
            }

            // 2. Update email
            if (email !== undefined) {
                if (typeof email !== "string" || !email.trim()) {
                    return res.status(400).json({
                        status: false,
                        message: "Email cannot be empty"
                    });
                }

                const emailTrimmed = email.trim().toLowerCase();

                const emailRegex =
                    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

                if (!emailRegex.test(emailTrimmed)) {
                    return res.status(400).json({
                        status: false,
                        message: "Invalid email address"
                    });
                }

                const existingUser = await User.findOne({
                    email: emailTrimmed,
                    _id: { $ne: userId }
                });

                if (existingUser) {
                    return res.status(409).json({
                        status: false,
                        message: "Email already in use"
                    });
                }

                user.email = emailTrimmed;
            }

            // 3. Update profile image URL
            if (profile !== undefined) {
                if (typeof profile !== "string" || !profile.trim()) {
                    return res.status(400).json({
                        status: false,
                        message: "Profile image URL cannot be empty"
                    });
                }

                user.profile = profile.trim();
            }

            // 4. Update education
            if (education !== undefined) {
                if (!Array.isArray(education)) {
                    return res.status(400).json({
                        status: false,
                        message: "Education must be an array"
                    });
                }

                user.education = education.map(item => ({
                    degree: item.degree,
                    institution: item.institution,
                    fieldOfStudy: item.fieldOfStudy,
                    startYear: item.startYear,
                    endYear: item.endYear
                }));
            }

            // 5. Update experience
            if (experience !== undefined) {
                if (!Array.isArray(experience)) {
                    return res.status(400).json({
                        status: false,
                        message: "Experience must be an array"
                    });
                }

                user.experience = experience.map(item => ({
                    company: item.company,
                    role: item.role,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    description: item.description
                }));
            }

            // 6. Update skills
            if (skills !== undefined) {
                if (typeof skills !== "string") {
                    return res.status(400).json({
                        status: false,
                        message: "Skills must be a string"
                    });
                }

                user.skills = skills.trim();
            }

            const updatedUser = await user.save();

            // Exclude sensitive fields from response
            const userData = updatedUser.toObject();

            delete userData.password;
            delete userData.otp;
            delete userData.__v;

            return res.status(200).json({
                status: true,
                message: "Profile updated successfully",
                user: userData
            });

        } catch (error) {
            // Handle duplicate email race conditions
            if (error.code === 11000 && error.keyPattern?.email) {
                return res.status(409).json({
                    status: false,
                    message: "Email already in use"
                });
            }

            console.error("Update profile error:", error);

            return res.status(500).json({
                status: false,
                message: "Internal server error"
            });
        }
    },

}