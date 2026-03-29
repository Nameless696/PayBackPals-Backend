/**
 * PayBackPal — Expense Model
 */
const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema(
    {
        groupId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
        amount:     { type: Number, required: true, min: 0, max: 10000000 },
        description:{ type: String, required: true, trim: true, maxlength: [200, 'Description must be under 200 characters'] },
        category:   { type: String, default: 'other' },
        paidBy:     { type: String, required: true },   // member id (string)
        splitAmong: { type: [String], default: [] },    // array of member ids
        date:       { type: Date, default: Date.now },

        // Optional metadata
        receipt:            { type: String, default: null }, // base64 data URL or S3 URL
        isSettlement:       { type: Boolean, default: false },
        isContribution:     { type: Boolean, default: false },
        settlementFrom:     { type: String, default: null },
        settlementTo:       { type: String, default: null },
        method:             { type: String, default: null },  // payment method for settlements
        customCategoryName: { type: String, default: null },
        customCategoryIcon: { type: String, default: null },
        group:              { type: String, default: '' },    // group name cached for display

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

ExpenseSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id      = ret._id.toString();
        ret.groupId = ret.groupId?.toString?.() ?? ret.groupId;
        ret.date    = ret.date instanceof Date ? ret.date.toISOString() : ret.date;
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

// Indexes for common queries
ExpenseSchema.index({ groupId: 1, date: -1 });
ExpenseSchema.index({ createdBy: 1, date: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
