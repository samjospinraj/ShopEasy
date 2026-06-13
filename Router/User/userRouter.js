const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { Otp, User } = require('../../Model/User/otp');
const { Signup } = require('../../Model/User/userAuther');
const { sendOTPEmail } = require('../../utils/emailService');
const { render } = require('ejs');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId  && req.session.isOtpVerified) {
        return next();
    }
    return res.redirect('/verification');
};

// Add rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) => {
        res.status(429).json({
            message: 'Too many login attempts, please try again later'
        });
    }
});

// Generate OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// GET verification page
router.get('/verification', async (req, res, next) => {
    try {
        return res.render('User/verification');
    } catch (error) {
        console.error("VERIFICATION route error:", error);
        return next(error);
    }
});

// GET signup page
router.get('/signup', isAuthenticated, async (req, res, next) => {
    try {
        return res.render('User/signup');
    } catch (error) {
        console.error("VERIFICATION route error:", error);
        return next(error);
    }
});

// GET Login page
router.get('/login', async (req, res, next) => {
    try {
        if (req.session?.isLoggedIn) {
            return res.redirect('/'); // or '/dashboard'
        }

        return res.render('User/login');
    } catch (error) {
        console.error("LOGIN route error:", error);
        return next(error);
    }
});

// 1. 📧 Send OTP
const MAX_ATTEMPTS = 5;
const OTP_EXPIRY_MS = 45 * 60 * 1000; // 45 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // prevent spam

// 📧 Send OTP
router.post('/verification', async (req, res) => {
    try {
        let { email } = req.body;

        // 1. Validate input
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required'
            });
        }

        // 2. Normalize email
        email = email.toLowerCase().trim();

        // Optional: Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // 3. Check if user already exists
        const existingUser = await Signup.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists',
                redirectUrl:'/login'
            });
        }

        // 4. Check resend cooldown
        const existingOtp = await Otp.findOne({ email });

        if (
            existingOtp &&
            existingOtp.createdAt &&
            Date.now() - new Date(existingOtp.createdAt).getTime() <
            RESEND_COOLDOWN_MS
        ) {
            const remainingTime = Math.ceil(
                (RESEND_COOLDOWN_MS -
                    (Date.now() -
                        new Date(existingOtp.createdAt).getTime())) /
                1000
            );

            return res.status(429).json({
                success: false,
                error: `Please wait ${remainingTime}s before requesting another OTP`
            });
        }

        // 5. Remove old OTP if exists
        await Otp.deleteOne({ email });

        // 6. Generate OTP
        const otp = generateOTP();

        // Hash OTP before storing
        const hashedOtp = await bcrypt.hash(otp, 10);

        // Expiry time
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

        // 7. Save OTP
        await Otp.create({
            email,
            otp: hashedOtp,
            expiresAt,
            attempts: 0
        });

        // 8. Send OTP email
        const sent = await sendOTPEmail(email, otp, 'verification');

        // 9. Rollback if email fails
        if (!sent) {
            await Otp.deleteOne({ email });

            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP email'
            });
        }

        // 10. Store session data
        req.session.email = email;
        req.session.isOtpVerified = false;

        console.log(`OTP sent successfully to ${email}`);

        // 11. Success response
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',

            // ⚠️ NEVER send OTP in production
            debugOtp: otp
        });

    } catch (error) {
        console.error('Verification OTP Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Verify OTP endpoint
router.post('/verify_otp', async (req, res) => {
    try {
        let { email, otp } = req.body;

        // 1. Validate input
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Email and OTP are required'
            });
        }

        // 2. Normalize data
        email = email.toLowerCase().trim();
        otp = otp.toString().trim();

        // Optional email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // 3. Find OTP record
        const record = await Otp.findOne({ email });

        console.log(`Verifying OTP for: ${email}`);

        if (!record) {
            return res.status(400).json({
                success: false,
                error: 'Invalid OTP or email'
            });
        }

        // 4. Check expiry
        if (record.expiresAt < new Date()) {
            await Otp.deleteOne({ email });

            return res.status(400).json({
                success: false,
                error: 'OTP has expired. Please request a new OTP.'
            });
        }

        // 5. Check max attempts
        if (record.attempts >= MAX_ATTEMPTS) {
            await Otp.deleteOne({ email });

            return res.status(429).json({
                success: false,
                error: 'Too many failed attempts. Please request a new OTP.'
            });
        }

        // 6. Compare OTP
        const isMatch = await bcrypt.compare(otp, record.otp);

        // 7. Invalid OTP handling
        if (!isMatch) {
            await Otp.updateOne(
                { email },
                { $inc: { attempts: 1 } }
            );

            const remainingAttempts =
                MAX_ATTEMPTS - (record.attempts + 1);

            return res.status(400).json({
                success: false,
                error: 'Invalid OTP',
                remainingAttempts: Math.max(remainingAttempts, 0)
            });
        }

        // 8. OTP valid → delete OTP
        await Otp.deleteOne({ email });

        // 9. Check if user already exists
        let user = await User.findOne({ email });

        // 10. Create verified user if not exists
        if (!user) {
            user = await User.create({
                email,
                otp: record.otp,
                isVerified: true,
                verifiedAt: new Date()
            });
        }

        // 11. Create session
        req.session.userId = user._id;
        req.session.email = user.email;
        req.session.isOtpVerified = true;
        req.session.verifiedEmail = email;

        console.log(`OTP verified successfully for ${email}`);

        // 12. Response
        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: user
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// RESEND OTP
router.post('/resend-otp', async (req, res) => {
    try {
        let { email } = req.body;

        // 1. Validate input
        if (!email || typeof email !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Valid email is required'
            });
        }

        // 2. Normalize email
        email = email.toLowerCase().trim();

        // 3. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // 4. Prevent resend for already registered users
        const existingUser = await Signup.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists'
            });
        }

        // 5. Find existing OTP
        const existingOtp = await Otp.findOne({ email });

        // 6. Cooldown protection
        if (existingOtp?.createdAt) {
            const timeDifference =
                Date.now() -
                new Date(existingOtp.createdAt).getTime();

            if (timeDifference < RESEND_COOLDOWN_MS) {
                const remainingTime = Math.ceil(
                    (RESEND_COOLDOWN_MS - timeDifference) / 1000
                );

                return res.status(429).json({
                    success: false,
                    error: `Please wait ${remainingTime}s before requesting another OTP`
                });
            }
        }

        // 7. Remove old OTP
        await Otp.deleteOne({ email });

        // 8. Generate new OTP
        const otp = generateOTP();

        // 9. Hash OTP
        const hashedOtp = await bcrypt.hash(otp, 10);

        // 10. Set expiry
        const expiresAt = new Date(
            Date.now() + OTP_EXPIRY_MS
        );

        // 11. Save OTP
        await Otp.create({
            email,
            otp: hashedOtp,
            expiresAt,
            attempts: 0
        });

        // 12. Send OTP email
        const sent = await sendOTPEmail(
            email,
            otp,
            'verification'
        );

        // 13. Rollback if email fails
        if (!sent) {
            await Otp.deleteOne({ email });

            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP email'
            });
        }

        console.log(`OTP resent successfully to ${email}`);

        // 14. Response
        return res.status(200).json({
            success: true,
            message: 'OTP resent successfully',

            // ⚠️ NEVER expose OTP in production
            debugOtp: otp
        });

    } catch (error) {
        console.error('Resend OTP Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// GET Route to Send Verified Email to Signup Page
router.get('/verified-email', async (req, res) => {
    try {
        const { isOtpVerified, verifiedEmail } = req.session || {};

        // 1. Validate OTP session
        if (!isOtpVerified) {
            return res.status(401).json({
                success: false,
                message: 'OTP not verified'
            });
        }

        // 2. Validate email existence in session
        if (!verifiedEmail) {
            return res.status(400).json({
                success: false,
                message: 'Verified email not found in session'
            });
        }

        // 3. Fetch user
        const user = await User.findOne({ email: verifiedEmail })
            .select('_id email')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 4. Success response
        return res.status(200).json({
            success: true,
            data: {
                id: user._id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Verified Email Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ✅ POST /signup
router.post('/signup', async (req, res) => {
    try {
        let { fullName, email, phone, password, confirmPassword, termsAccepted } = req.body;

        // 1. Validate required fields
        if (!fullName || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be filled'
            });
        }

        // 2. Normalize input
        fullName = fullName.trim();
        email = email.toLowerCase().trim();

        if (phone) {
            phone = phone.toString().trim();
        }

        // 3. Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // 4. OTP verification check
        if (!req.session.isOtpVerified) {
            return res.status(401).json({
                success: false,
                message: 'OTP verification required. Please verify your email first.'
            });
        }

        // 5. Get verified email from session
        const verifiedEmail = req.session.email;

        if (!verifiedEmail) {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please verify OTP again.'
            });
        }

        // 6. Match verified email
        if (email !== verifiedEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email mismatch. Please verify OTP for this email.'
            });
        }

        // 7. Password validation
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // 8. Password strength
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain uppercase, lowercase, number and be at least 6 characters long'
            });
        }

        // 9. Terms acceptance
        if (!termsAccepted) {
            return res.status(400).json({
                success: false,
                message: 'You must accept Terms & Privacy Policy'
            });
        }

        // 10. Find verified user
        const verifiedUser = await User.findOne({ email });

        if (!verifiedUser) {
            return res.status(404).json({
                success: false,
                message: 'Verification record not found. Please verify your email first.'
            });
        }

        // 11. Ensure email verified
        if (!verifiedUser.isVerified) {
            return res.status(401).json({
                success: false,
                message: 'Email not verified. Please complete OTP verification.'
            });
        }

        // 12. Prevent duplicate signup
        const existingUser = await Signup.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // 13. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 14. Create signup profile
        const newUser = await Signup.create({
            userId: verifiedUser._id,
            fullName,
            email,
            phone,
            password: hashedPassword,
            confirmPassword,
            termsAccepted,
            isVerified: true
        });

        console.log('CRATE NEW USER : ', newUser);

        // 15. Create login session
        req.session.userId = newUser._id;
        req.session.email = newUser.email;
        req.session.isLoggedIn = true;

        // Optional cleanup
        req.session.isOtpVerified = false;

        console.log(`User registered successfully: ${email}`);

        // 16. Success response
        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                phone: newUser.phone
            }
        });

    } catch (error) {
        console.error('Signup Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// ✅ POST/login
router.post('/login', loginLimiter,  async (req, res, next) => {
    try {
        let { email, password } = req.body;

        // 1. Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // 2. Normalize email
        email = email.toLowerCase().trim();

        // 3. Find user
        const user = await Signup.findOne({ email });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email'
            });
        }

        // 🚨 4. BLOCK CHECK (IMPORTANT)
        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked. Contact admin.'
            });
        }

        // 5. Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }

        // 6. Create session
        req.session.userId = user._id;
        req.session.email = user.email;
        req.session.isLoggedIn = true;

        // 7. Save session
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Session error'
                });
            }

            const allowedRoutes = ['/cart', '/wishlist', '/'];

            const redirectUrl = allowedRoutes.includes(req.session.returnTo)
                ? req.session.returnTo
                : '/';

            delete req.session.returnTo;

            return res.json({
                success: true,
                message: 'Login successful',
                redirectUrl
            });
        });

    } catch (error) {
        console.error('Failed to login:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;