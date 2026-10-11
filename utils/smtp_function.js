const axios = require("axios");

async function sendEmail(userEmail, message) {
    try {
        console.log("Sending email via Brevo API...");

        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Preply",
                    email: process.env.VERIFIED_GMAIL
                },

                to: [
                    {
                        email: userEmail
                    }
                ],

                subject: "Your Preply Verification Code",

                htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preply Verification</title>
</head>

<body style="
    margin: 0;
    padding: 0;
    background: #f3f6ff;
    font-family: Arial, Helvetica, sans-serif;
">

    <!-- Background -->
    <div style="
        width: 100%;
        background: linear-gradient(135deg, #eef2ff 0%, #f8faff 50%, #e8f0ff 100%);
        padding: 45px 15px;
        box-sizing: border-box;
    ">

        <!-- Main Card -->
        <div style="
            max-width: 520px;
            margin: auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(37, 99, 235, 0.12);
        ">

            <!-- Header -->
            <div style="
                background: linear-gradient(135deg, #2563eb, #4f46e5);
                padding: 32px 30px;
                text-align: center;
            ">

                <div style="
                    display: inline-block;
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 14px;
                    padding: 10px 18px;
                    margin-bottom: 15px;
                ">
                    <span style="
                        color: #ffffff;
                        font-size: 24px;
                        font-weight: 700;
                        letter-spacing: -0.5px;
                    ">
                        Preply
                    </span>
                </div>

                <h1 style="
                    margin: 5px 0 0;
                    color: #ffffff;
                    font-size: 24px;
                    line-height: 1.3;
                ">
                    Verify your account
                </h1>

                <p style="
                    margin: 10px 0 0;
                    color: rgba(255,255,255,0.85);
                    font-size: 14px;
                ">
                    One quick step to continue with Preply
                </p>

            </div>


            <!-- Content -->
            <div style="
                padding: 35px 35px 30px;
            ">

                <p style="
                    margin: 0 0 15px;
                    color: #1f2937;
                    font-size: 16px;
                    line-height: 1.6;
                ">
                    Hello,
                </p>

                <p style="
                    margin: 0 0 25px;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1.7;
                ">
                    Use the verification code below to complete your
                    Preply account verification.
                </p>


                <!-- OTP Box -->
                <div style="
                    background: #f5f7ff;
                    border: 1px solid #dbe4ff;
                    border-radius: 16px;
                    padding: 24px 20px;
                    text-align: center;
                    margin: 10px 0 25px;
                ">

                    <p style="
                        margin: 0 0 10px;
                        color: #64748b;
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        font-weight: 600;
                    ">
                        Verification Code
                    </p>

                    <div style="
                        color: #2563eb;
                        font-size: 34px;
                        font-weight: 700;
                        letter-spacing: 8px;
                        line-height: 1.2;
                    ">
                        ${message}
                    </div>

                    <p style="
                        margin: 12px 0 0;
                        color: #94a3b8;
                        font-size: 12px;
                    ">
                        Enter this code in the Preply app
                    </p>

                </div>


                <!-- Security Notice -->
                <div style="
                    background: #fff7ed;
                    border-left: 4px solid #f97316;
                    border-radius: 8px;
                    padding: 13px 15px;
                    margin-bottom: 25px;
                ">

                    <p style="
                        margin: 0;
                        color: #9a3412;
                        font-size: 12px;
                        line-height: 1.6;
                    ">
                        <strong>Security reminder:</strong>
                        Never share this verification code with anyone.
                        Preply will never ask you for your OTP.
                    </p>

                </div>


                <p style="
                    margin: 0;
                    color: #64748b;
                    font-size: 13px;
                    line-height: 1.7;
                ">
                    If you didn't request this verification code,
                    you can safely ignore this email.
                </p>

            </div>


            <!-- Footer -->
            <div style="
                background: #f8fafc;
                border-top: 1px solid #eef2f7;
                padding: 22px 30px;
                text-align: center;
            ">

                <p style="
                    margin: 0 0 6px;
                    color: #64748b;
                    font-size: 12px;
                ">
                    © ${new Date().getFullYear()} Preply
                </p>

                <p style="
                    margin: 0;
                    color: #94a3b8;
                    font-size: 11px;
                ">
                    This is an automated message. Please do not reply.
                </p>

            </div>

        </div>

    </div>

</body>
</html>
                `
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Email sent ✅", response.data);

        return {
            success: true
        };

    } catch (error) {

        console.error(
            "Brevo API Error ❌:",
            error.response?.data || error.message
        );

        return {
            success: false
        };
    }
}

module.exports = sendEmail;