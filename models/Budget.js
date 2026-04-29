/**
 * PayBackPal — Budget Model
 * Monthly spending limit per user
 */
const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema(
    {
        userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        monthlyLimit: { type: Number, required: true, min: 0, max: 100000000 },
    },
    { timestamps: true }
);

BudgetSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id     = ret._id.toString();
        ret.userId = ret.userId?.toString?.() ?? ret.userId;
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

BudgetSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
