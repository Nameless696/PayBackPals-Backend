/**
 * PayBackPal — Auth Controller
 * POST /api/auth/register
 * POST /api/auth/verify
 * POST /api/auth/resend-verification
 * POST /api/auth/login
 * GET  /api/auth/me
 * PATCH /api/auth/profile
 */
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');

// ── Helper: sign JWT ──────────────────────────────────────────────
const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// ── Helper: 6-digit code ─────────────────────────────────────────
const makeCode = () => String(Math.floor(100000 + Math.random() * 900000));

// ── Helper: send verification email ──────────────────────────────
async function sendVerificationEmail(email, name, code) {
    if (!process.env.GOOGLE_SCRIPT_URL) {
        console.warn('[Auth] GOOGLE_SCRIPT_URL missing - skipping email (print out instead)');
        console.log(`>>> YOUR CODE IS: ${code} <<<`);
        return;
    }
    
    try {
        const payload = {
            to: email,
            subject: 'Your PayBackPal verification code',
            fromName: 'PayBackPal',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                    <h2 style="color:#6C63FF;">Welcome to PayBackPal, ${name}! 👋</h2>
                    <p style="color:#555;">Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
                    <div style="background:#f4f4f8;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#6C63FF;">${code}</span>
                    </div>
                    <p style="color:#888;font-size:13px;">If you didn't create a PayBackPal account, you can safely ignore this email.</p>
                </div>
            `
        };

        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if(!result.success) throw new Error(result.error || 'Unknown script error');

        console.log(`[Auth] Google Script Relay Executed for ${email}`);
    } catch (err) {
        console.error(`\n[Auth] === GOOGLE SCRIPT RELAY FAILED ===`);
        console.error(`Error: ${err.message}`);
        console.error(`>>> YOUR CODE IS: ${code} <<<\n`);
    }
}

// ── Register ──────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            if (!existing.isVerified) {
                return res.status(400).json({ message: 'A verification code has been sent to this email.', needsVerification: true, email: existing.email });
            }
            return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
        }

        const code = makeCode();
        const user = await User.create({
            name:                name.trim(),
            email:               email.toLowerCase().trim(),
            password,
            verificationToken:   code,
            verificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        });

        // Respond immediately — don't block on email delivery
        res.status(201).json({
            needsVerification: true,
            email: user.email,
            message: 'Account created! Check your email for a 6-digit verification code.',
        });

        // Fire-and-forget email in background
        sendVerificationEmail(user.email, user.name, code).catch(e =>
            console.error('[Auth] Background email failed:', e.message)
        );
    } catch (err) {
        next(err);
    }
};

// ── Verify Email ──────────────────────────────────────────────────
exports.verifyEmail = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ message: 'Email and code are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+verificationToken +verificationExpires');

        if (!user) return res.status(404).json({ message: 'Account not found' });
        if (user.isVerified) return res.status(400).json({ message: 'Email already verified. Please log in.' });

        if (user.verificationToken !== String(code).trim()) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        if (user.verificationExpires < new Date()) {
            return res.status(400).json({ message: 'Code expired. Request a new one.' });
        }

        user.isVerified          = true;
        user.verificationToken   = null;
        user.verificationExpires = null;
        await user.save();

        const token = signToken(user._id);
        res.json({ token, user: user.toProfile() });
    } catch (err) {
        next(err);
    }
};

// ── Resend Verification ───────────────────────────────────────────
exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+verificationToken +verificationExpires');

        if (!user)          return res.status(404).json({ message: 'Account not found' });
        if (user.isVerified) return res.status(400).json({ message: 'Email already verified. Please log in.' });

        const code = makeCode();
        user.verificationToken   = code;
        user.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        // Respond immediately — email sent in background
        res.json({ message: 'New verification code sent!' });
        sendVerificationEmail(user.email, user.name, code).catch(e =>
            console.error('[Auth] Background resend failed:', e.message)
        );
    } catch (err) {
        next(err);
    }
};

// ── Login ─────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: 'Please verify your email before logging in.',
                needsVerification: true,
                email: user.email,
            });
        }

        const token = signToken(user._id);
        res.json({ token, user: user.toProfile() });
    } catch (err) {
        next(err);
    }
};

// ── Get current user ──────────────────────────────────────────────
exports.getMe = async (req, res) => {
    res.json({ user: req.user.toProfile() });
};

// ── Update profile ────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
    try {
        const { name, email, password, avatar } = req.body;
        const user = await User.findById(req.user._id);

        if (name)  user.name  = name.trim();
        if (email) user.email = email.toLowerCase().trim();
        if (avatar) user.avatar = avatar; // Persist Base64
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password must be at least 8 characters' });
            }
            user.password = password; // pre-save hook will re-hash
        }

        await user.save();
        res.json({ user: user.toProfile() });
    } catch (err) {
        next(err);
    }
};

// ── Delete Account ────────────────────────────────────────────────
exports.deleteAccount = async (req, res, next) => {
    try {
        const User = require('../models/User');
        await User.findByIdAndDelete(req.user._id);
        res.json({ message: 'Account deleted forever.' });
    } catch (err) {
        next(err);
    }
};

// ── Change Password ──────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');
        
        if (!(await user.matchPassword(currentPassword))) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }
        
        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password successfully updated' });
    } catch (err) { next(err); }
};

// ── Forgot Password ──────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if(!email) return res.status(400).json({ message: 'Email required' });

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) return res.status(404).json({ message: 'No account with that email found' });
        
        const code = makeCode();
        user.verificationToken = code;
        user.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
        
        // Respond immediately — email sent in background
        res.json({ message: 'Password reset code sent to your email' });
        sendVerificationEmail(user.email, user.name, code).catch(e =>
            console.error('[Auth] Background forgot-pw email failed:', e.message)
        );
    } catch (err) { next(err); }
};

// ── Reset Password ──────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, code, newPassword } = req.body;
        if(!email || !code || !newPassword) return res.status(400).json({ message: 'Missing fields' });

        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select('+verificationToken +verificationExpires');
            
        if (!user) return res.status(404).json({ message: 'Account not found' });
        if (user.verificationToken !== String(code).trim()) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        if (user.verificationExpires < new Date()) {
            return res.status(400).json({ message: 'Code expired. Request a new one.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }
        
        user.password = newPassword;
        user.verificationToken = null;
        user.verificationExpires = null;
        await user.save();
        
        const token = signToken(user._id);
        res.json({ message: 'Password successfully retrieved', token, user: user.toProfile() });
    } catch (err) { next(err); }
};
