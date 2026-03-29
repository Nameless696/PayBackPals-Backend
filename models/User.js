/**
 * PayBackPal — User Model
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema(
    {
        name:     { type: String, required: [true, 'Name is required'],  trim: true },
        email:    { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
        password: { type: String, required: [true, 'Password is required'], minlength: [8, 'Password must be at least 8 characters'], select: false },
        avatar:   { type: String, default: '' },

        // Email verification
        isVerified:          { type: Boolean, default: false },
        verificationToken:   { type: String, default: null, select: false },
        verificationExpires: { type: Date,   default: null, select: false },
    },
    { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare entered password with stored hash
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

// Return clean user object (no password)
UserSchema.methods.toProfile = function () {
    return {
        id:     this._id.toString(),
        name:   this.name,
        email:  this.email,
        avatar: this.avatar || this.name.charAt(0).toUpperCase(),
    };
};

module.exports = mongoose.model('User', UserSchema);
