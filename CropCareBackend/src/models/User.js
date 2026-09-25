const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    isPhoneVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpPurpose: { type: String, enum: ['signup', 'login'], select: false },
    otpExpiresAt: { type: Date, select: false },
    otpLastSentAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
