/**
 * PayBackPal — Email Controller (Nodemailer)
 * POST /api/emails/send
 */
exports.sendEmail = async (req, res, next) => {
    try {
        const { to, subject, body, html } = req.body;
        if (!to || !subject) {
            return res.status(400).json({ message: 'to and subject are required' });
        }

        if (!process.env.GOOGLE_SCRIPT_URL) {
            console.warn('[Email] GOOGLE_SCRIPT_URL not set — skipping send');
            return res.json({ message: 'Email skipped (credentials not configured)', sent: false });
        }

        const payload = {
            to,
            subject,
            fromName: 'PayBackPal',
            html: html || body || ''
        };

        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if(!result.success) throw new Error(result.error);

        console.log(`[Email] HTTPS Relay executed to ${to}`);
        res.json({ message: 'Email sent', sent: true });
    } catch (err) {
        console.error('[Email] Send error:', err.message);
        res.status(500).json({ message: 'Email failed: ' + err.message, sent: false });
    }
};
