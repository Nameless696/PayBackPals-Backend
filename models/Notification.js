/**
 * PayBackPal — Notification Model
 */
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
    {
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type:      { type: String, required: true },
        message:   { type: String, required: true },
        data:      { type: mongoose.Schema.Types.Mixed, default: {} },
        read:      { type: Boolean, default: false },
        timestamp: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

NotificationSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id        = ret._id.toString();
        ret.timestamp = ret.timestamp instanceof Date ? ret.timestamp.toISOString() : ret.timestamp;
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
    },
});

module.exports = mongoose.model('Notification', NotificationSchema);
