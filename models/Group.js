/**
 * PayBackPal — Group Model
 */
const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for invited-but-unregistered
        id:     { type: String },   // string form of userId or legacy frontend id
        name:   { type: String, required: true },
        email:  { type: String, default: '' },
    },
    { _id: false }
);

const GroupSchema = new mongoose.Schema(
    {
        name:        { type: String, required: [true, 'Group name is required'], trim: true, maxlength: [60, 'Group name must be under 60 characters'] },
        description: { type: String, default: '', maxlength: [300, 'Description must be under 300 characters'] },
        icon:        { type: String, default: '👥' },
        iconType:    { type: String, enum: ['emoji', 'image'], default: 'emoji' },
        members:     [MemberSchema],
        createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

// Virtual: return id as string in JSON
GroupSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id        = ret._id.toString();
        ret.createdBy = ret.createdBy?.toString?.() ?? ret.createdBy;
        ret.createdAt = ret.createdAt?.toISOString?.() ?? ret.createdAt;
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

// Indexes for common queries
GroupSchema.index({ 'members.id': 1, createdAt: -1 });
GroupSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Group', GroupSchema);
