/**
 * PayBackPal — Backend Server
 * Node.js + Express + MongoDB + JWT
 *
 * Start dev: npm run dev
 * Start prod: npm start
 *
 * Requires: cp .env.example .env  (then fill in your values)
 */

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const connectDB    = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const groupRoutes        = require('./routes/group.routes');
const expenseRoutes      = require('./routes/expense.routes');
const notificationRoutes = require('./routes/notification.routes');
const syncRoutes         = require('./routes/sync.routes');
const emailRoutes        = require('./routes/email.routes');

// ── Connect to MongoDB ─────────────────────────────────────────────
connectDB();

const app = express();
app.set('trust proxy', 1);

// ── Security & Parsing ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — allow the frontend origin (file://, localhost:8080, etc.)
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:5500',  // VS Code Live Server default
    'http://127.0.0.1:8080',
    'null',                    // file:// origin appears as "null"
];
app.use(cors({
    origin: (origin, cb) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));  // 10 MB to handle base64 receipts
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate Limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Auth routes get a stricter limit
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many auth attempts, please try again in 15 minutes' },
});
app.use('/api/auth/', authLimiter);

// Resend-verification gets a very strict limit (3 per hour per IP)
const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { message: 'Too many verification code requests. Please wait an hour before trying again.' },
});
app.use('/api/auth/resend-verification', resendLimiter);

// ── Mount API Routes ──────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/expenses',      expenseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync',          syncRoutes);
app.use('/api/emails',        emailRoutes);

// ── Health check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', time: new Date().toISOString(), version: '2.0.0' })
);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` }));

// ── Global Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 PayBackPal backend running on http://localhost:${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
// Rebooting node instance...
// ── Delete Account ────────────────────────────────────────────────
