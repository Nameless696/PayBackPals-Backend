/**
 * PayBackPal — Email Controller (Nodemailer)
 * POST /api/emails/send
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    transporter = nodemailer.createTransport({
        host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
        port:   Number(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    return transporter;
}

exports.sendEmail = async (req, res, next) => {
    try {
        const { to, subject, body, html } = req.body;
        if (!to || !subject) {
            return res.status(400).json({ message: 'to and subject are required' });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('[Email] EMAIL_USER or EMAIL_PASS not set — skipping send');
            return res.json({ message: 'Email skipped (credentials not configured)', sent: false });
        }

        const info = await getTransporter().sendMail({
            from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to,
            subject,
            text: body || '',
            html: html || body || '',
        });

        console.log(`[Email] Sent to ${to}: ${info.messageId}`);
        res.json({ message: 'Email sent', messageId: info.messageId, sent: true });
    } catch (err) {
        console.error('[Email] Send error:', err.message);
        // Don't crash the app if email fails — just report
        res.status(500).json({ message: 'Email failed: ' + err.message, sent: false });
    }
};
