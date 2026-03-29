/**
 * PayBackPal — Notification Controller
 */
const Notification = require('../models/Notification');

// ── GET /api/notifications ────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
    try {
        const notifs = await Notification.find({ userId: req.user._id }).sort('-timestamp');
        res.json({ notifications: notifs.map(n => n.toJSON()) });
    } catch (err) { next(err); }
};

// ── PATCH /api/notifications/:id ──────────────────────────────────
exports.markRead = async (req, res, next) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        res.json({ notification: notif.toJSON() });
    } catch (err) { next(err); }
};

// ── PATCH /api/notifications/read-all ────────────────────────────
exports.markAllRead = async (req, res, next) => {
    try {
        await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
        res.json({ message: 'All notifications marked as read' });
    } catch (err) { next(err); }
};

// ── DELETE /api/notifications/:id ────────────────────────────────
exports.deleteNotification = async (req, res, next) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.json({ message: 'Notification deleted' });
    } catch (err) { next(err); }
};

// ── Internal helper: create notification (used by other controllers) ──
exports.createNotification = async (userId, type, message, data = {}) => {
    try {
        return await Notification.create({ userId, type, message, data });
    } catch (err) {
        console.error('[Notification] create failed:', err.message);
    }
};
