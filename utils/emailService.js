const nodemailer = require('nodemailer');
require('dotenv').config();

// ✅ Create transporter (clean version)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

// ✅ Optional: verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('Email server is ready');
    }
});

const sendOTPEmail = async (email, otp, purpose = 'verification') => {
    let subject = '';
    let htmlContent = '';

    // Common OTP email styling – now using ShopEasy 2026 brand colors
    const baseStyle = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
            .email-container {
                max-width: 520px; margin: 0 auto;
                background: linear-gradient(135deg, #ffffff 0%, #fefefe 100%);
                border-radius: 28px; overflow: hidden;
                box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.15);
            }
            .header-gradient {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                padding: 32px 24px; text-align: center;
            }
            .logo { font-size: 32px; font-weight: 800; color: white; letter-spacing: -0.5px; }
            .logo span { font-weight: 300; }
            .content { padding: 36px 32px; }
            .title { font-size: 26px; font-weight: 800; color: #2c3e50; margin-bottom: 12px; text-align: center; }
            .subtitle { font-size: 15px; color: #64748b; text-align: center; margin-bottom: 32px; line-height: 1.5; }
            .otp-box {
                background: linear-gradient(135deg, #fff5f5 0%, #ffe8e0 100%);
                border-radius: 20px; padding: 28px 20px; text-align: center; margin: 24px 0;
                border: 1px solid rgba(255, 107, 107, 0.2);
            }
            .otp-code {
                font-size: 48px; font-weight: 800; letter-spacing: 8px; color: #ff6b6b;
                background: white; display: inline-block; padding: 16px 28px;
                border-radius: 18px; font-family: 'Courier New', monospace;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
            .timer-badge {
                display: inline-block; background: #fff3e0; color: #f97316; padding: 6px 16px;
                border-radius: 40px; font-size: 13px; font-weight: 600; margin-top: 16px;
            }
            .message { font-size: 14px; color: #475569; line-height: 1.6; text-align: center; margin: 24px 0 16px; }
            .footer-note {
                border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;
                background: #fdfcfb;
            }
            .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.5; }
            .button-secure {
                background: #ff6b6b; color: white; padding: 4px 12px; border-radius: 30px;
                font-size: 11px; font-weight: 600; display: inline-block;
            }
            @media (max-width: 480px) {
                .content { padding: 24px 20px; }
                .otp-code { font-size: 36px; letter-spacing: 4px; padding: 12px 20px; }
                .title { font-size: 22px; }
            }
        </style>
    `;

    // Purpose-specific configurations (now includes delivery)
    const configs = {
        verification: {
            title: 'Verify Your Email',
            emoji: '✨',
            message: 'Please use the verification code below to complete your email verification and activate your account.',
            buttonText: 'Verify Now'
        },
        login: {
            title: 'Login Verification',
            emoji: '🔐',
            message: 'Use this one-time password to securely log into your account. Do not share this code with anyone.',
            buttonText: 'Secure Login'
        },
        reset: {
            title: 'Password Reset',
            emoji: '🔄',
            message: 'You requested to reset your password. Use the OTP below to proceed with creating a new password.',
            buttonText: 'Reset Password'
        },
        twofactor: {
            title: 'Two-Factor Authentication',
            emoji: '🛡️',
            message: 'Your 2FA verification code is ready. Enter this code to complete your secure login.',
            buttonText: 'Verify 2FA'
        },
        delivery: {
            title: 'Delivery Confirmation',
            emoji: '📦',
            message: 'Use this OTP to confirm your delivery address and proceed with the order. Do not share this code with anyone.',
            buttonText: 'Confirm Delivery'
        }
    };

    // Select config based on purpose, fallback to verification
    const config = configs[purpose] || configs.verification;

    subject = `${config.emoji} ${config.title} - Your OTP Code`;

    htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${baseStyle}
        </head>
        <body style="margin: 0; padding: 20px; background: #f0f3f8; font-family: 'Inter', Arial, sans-serif;">
            <div style="max-width: 520px; margin: 0 auto;">
                <div class="email-container">
                    <!-- Header with ShopEasy Red-Orange Gradient -->
                    <div class="header-gradient">
                        <div class="logo">
                            ShopEasy <span>✦</span>
                        </div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.95); margin-top: 8px;">
                            Premium Shopping Experience
                        </div>
                    </div>
                    
                    <!-- Main Content -->
                    <div class="content">
                        <div class="title">
                            ${config.title}
                        </div>
                        <div class="subtitle">
                            ${purpose === 'verification' ? 'Complete your registration' : 
                              purpose === 'login' ? 'Secure access to your account' :
                              purpose === 'reset' ? 'Recover account access' :
                              purpose === 'twofactor' ? 'Enhanced security verification' :
                              purpose === 'delivery' ? 'Verify your delivery address' :
                              'Action required'}
                        </div>
                        
                        <!-- OTP Code Box -->
                        <div class="otp-box">
                            <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">
                                YOUR VERIFICATION CODE
                            </div>
                            <div class="otp-code">
                                ${otp}
                            </div>
                            <div class="timer-badge">
                                ⏱️ Valid for 10 minutes
                            </div>
                        </div>
                        
                        <!-- Message -->
                        <div class="message">
                            ${config.message}
                        </div>
                        
                        <!-- Security Note -->
                        <div style="background: #fef2f2; border-radius: 16px; padding: 14px; margin: 20px 0; text-align: center; border-left: 3px solid #ff6b6b;">
                            <div style="font-size: 13px; color: #991b1b;">
                                <strong>⚠️ Security Alert:</strong> Never share this OTP with anyone. Our team will never ask for this code.
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="footer-note">
                        <div class="footer-text">
                            <span class="button-secure">🔒 Secure Transaction</span>
                            <br><br>
                            This OTP was requested for your ShopEasy account.<br>
                            If you didn't request this, please ignore this email or contact support.
                            <br><br>
                            <strong>ShopEasy Team</strong><br>
                            <span style="font-size: 11px;">Need help? Contact us at support@shopeasy.com</span>
                        </div>
                    </div>
                </div>
                
                <!-- Micro Message -->
                <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
                    © 2026 ShopEasy — Secure & Trusted Platform
                </div>
            </div>
        </body>
        </html>
    `;

    const mailOptions = {
        from: `"ShopEasy" <${process.env.EMAIL}>`,
        to: email,
        subject,
        html: htmlContent
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent successfully to ${email} for purpose: ${purpose}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send OTP email to ${email}:`, error.message);
        return false;
    }
};

const sendEmail = async (to, subject, html) => {
    const mailOptions = {
        from: `"ShopEasy" <${process.env.EMAIL}>`,
        to,
        subject,
        html
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
        return true;
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
        return false;
    }
};

module.exports = { sendOTPEmail, sendEmail };