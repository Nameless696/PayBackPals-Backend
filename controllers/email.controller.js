/**
 * PayBackPal — Email Controller (Nodemailer)
 * POST /api/emails/send
 */
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendEmail = async (req, res, next) => {
    try {
        const { to, subject, body, html } = req.body;
        if (!to || !subject) {
            return res.status(400).json({ message: 'to and subject are required' });
        }

        if (!process.env.RESEND_API_KEY) {
            console.warn('[Email] RESEND_API_KEY not set — skipping send');
            return res.json({ message: 'Email skipped (credentials not configured)', sent: false });
        }

        const { data, error } = await resend.emails.send({
            from:    'PayBackPal <onboarding@resend.dev>',
            to,
            subject,
            text: body || '',
            html: html || body || '',
        });
        
        if (error) throw new Error(error.message);

        console.log(`[Email] Generic Output via Resend to ${to}: ${data.id}`);
        res.json({ message: 'Email sent', messageId: data.id, sent: true });
    } catch (err) {
        console.error('[Email] Send error:', err.message);
        // Don't crash the app if email fails — just report
        res.status(500).json({ message: 'Email failed: ' + err.message, sent: false });
    }
};
