/**
 * PayBackPal — Email Controller (Nodemailer)
 * POST /api/emails/send
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // enforce SSL
    auth: {
        user: process.env.GOOGLE_EMAIL || 'paybackpal169@gmail.com',
        pass: process.env.GOOGLE_APP_PASSWORD || ''
    }
});

exports.sendEmail = async (req, res, next) => {
    try {
        const { to, subject, body, html } = req.body;
        if (!to || !subject) {
            return res.status(400).json({ message: 'to and subject are required' });
        }

        if (!process.env.GOOGLE_APP_PASSWORD) {
            console.warn('[Email] GOOGLE_APP_PASSWORD not set — skipping send');
            return res.json({ message: 'Email skipped (credentials not configured)', sent: false });
        }

        const info = await transporter.sendMail({
            from: `"PayBackPal" <${process.env.GOOGLE_EMAIL || 'paybackpal169@gmail.com'}>`,
            to,
            subject,
            text: body || '',
            html: html || body || '',
        });

        console.log(`[Email] Physical mail routed to ${to}: ${info.messageId}`);
        res.json({ message: 'Email sent', messageId: info.messageId, sent: true });
    } catch (err) {
        console.error('[Email] Send error:', err.message);
        res.status(500).json({ message: 'Email failed: ' + err.message, sent: false });
    }
};
