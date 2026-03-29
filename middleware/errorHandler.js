/**
 * PayBackPal — Global Error Handler Middleware
 */
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(400).json({ message: `${field} is already in use` });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(e => e.message).join(', ');
        return res.status(400).json({ message });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
    }

    const status  = err.statusCode || err.status || 500;
    const message = err.message   || 'Internal server error';
    res.status(status).json({ message });
};
