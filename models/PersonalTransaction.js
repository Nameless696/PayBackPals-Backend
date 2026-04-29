/**
 * PayBackPal — Personal Transaction Model
 * Solo income/expense tracking, separate from group expenses
 */
const mongoose = require('mongoose');

const PersonalTransactionSchema = new mongoose.Schema(
    {
        userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type:        { type: String, enum: ['income', 'expense'], required: true },
        amount:      { type: Number, required: true, min: 0, max: 10000000 },
        description: { type: String, required: true, trim: true, maxlength: 200 },
        category:    { type: String, default: 'other' },
        date:        { type: Date, default: Date.now },

        // Recurring support
        isRecurring:  { type: Boolean, default: false },
        recurringDay: { type: Number, default: null, min: 1, max: 28 }, // day of month (1-28 to avoid month-end issues)
    },
    { timestamps: true }
);

PersonalTransactionSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id     = ret._id.toString();
        ret.userId = ret.userId?.toString?.() ?? ret.userId;
        ret.date   = ret.date instanceof Date ? ret.date.toISOString() : ret.date;
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

PersonalTransactionSchema.index({ userId: 1, date: -1 });
PersonalTransactionSchema.index({ userId: 1, isRecurring: 1 });

module.exports = mongoose.model('PersonalTransaction', PersonalTransactionSchema);
