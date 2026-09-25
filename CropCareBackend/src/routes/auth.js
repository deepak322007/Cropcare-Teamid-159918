const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { createOtp, hashOtp, sendOtp } = require('../services/otpService');
const { isValidPhone, normalizePhone } = require('../utils/validate');

const router = express.Router();
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

function createToken(user) {
  return jwt.sign({ sub: user.id, phone: user.phone }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function publicUser(user) {
  return { id: user.id, name: user.name, phone: user.phone, isPhoneVerified: user.isPhoneVerified };
}

async function issueOtp(user, purpose) {
  const cooldown = Number(process.env.OTP_COOLDOWN_SECONDS || 60) * 1000;
  if (user.otpLastSentAt && Date.now() - user.otpLastSentAt.getTime() < cooldown) {
    const retryAfter = Math.ceil((cooldown - (Date.now() - user.otpLastSentAt.getTime())) / 1000);
    const error = new Error(`Please wait ${retryAfter} seconds before requesting another OTP`);
    error.statusCode = 429;
    throw error;
  }

  const otp = createOtp();
  user.otpHash = hashOtp(otp);
  user.otpPurpose = purpose;
  user.otpExpiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRES_MINUTES || 5) * 60 * 1000);
  user.otpLastSentAt = new Date();
  user.otpAttempts = 0;
  await user.save();
  await sendOtp(user.phone, otp, purpose);
}

router.post('/signup', async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const phone = normalizePhone(req.body.phone);
    if (!name || !phone || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Name, phone, and a password of at least 8 characters are required' });
    }

    let user = await User.findOne({ phone }).select('+otpHash +otpPurpose +otpExpiresAt +otpLastSentAt +otpAttempts');
    if (user?.isPhoneVerified) {
      return res.status(409).json({ message: 'An account with this phone number already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    if (!user) user = new User({ name: name.trim(), phone, passwordHash });
    else { user.name = name.trim(); user.passwordHash = passwordHash; }
    await user.save();
    await issueOtp(user, 'signup');
    return res.status(201).json({ message: 'OTP sent to your mobile number', phone });
  } catch (error) { return next(error); }
});

router.post('/verify-phone', otpLimiter, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const { otp } = req.body;
    const user = await User.findOne({ phone }).select('+otpHash +otpPurpose +otpExpiresAt +otpAttempts');
    if (!user || user.otpPurpose !== 'signup') return res.status(400).json({ message: 'No signup OTP is pending' });
    if (user.otpAttempts >= 5) return res.status(429).json({ message: 'Too many incorrect attempts; request a new OTP' });
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) return res.status(400).json({ message: 'OTP has expired' });
    if (hashOtp(String(otp)) !== user.otpHash) {
      user.otpAttempts += 1; await user.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    user.isPhoneVerified = true; user.otpHash = undefined; user.otpPurpose = undefined; user.otpExpiresAt = undefined; user.otpAttempts = 0;
    await user.save();
    return res.json({ message: 'Phone number verified', token: createToken(user), user: publicUser(user) });
  } catch (error) { return next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const user = await User.findOne({ phone });
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash))) return res.status(401).json({ message: 'Invalid phone number or password' });
    if (!user.isPhoneVerified) return res.status(403).json({ message: 'Please verify your phone number first' });
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { return next(error); }
});

router.post('/request-login-otp', otpLimiter, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const user = await User.findOne({ phone }).select('+otpHash +otpPurpose +otpExpiresAt +otpLastSentAt +otpAttempts');
    if (!user || !user.isPhoneVerified) return res.status(404).json({ message: 'No verified account found for this phone number' });
    await issueOtp(user, 'login');
    return res.json({ message: 'OTP sent to your mobile number' });
  } catch (error) { return next(error); }
});

router.post('/login-with-otp', otpLimiter, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const user = await User.findOne({ phone }).select('+otpHash +otpPurpose +otpExpiresAt +otpAttempts');
    if (!user || user.otpPurpose !== 'login') return res.status(400).json({ message: 'No login OTP is pending' });
    if (user.otpAttempts >= 5) return res.status(429).json({ message: 'Too many incorrect attempts; request a new OTP' });
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) return res.status(400).json({ message: 'OTP has expired' });
    if (hashOtp(String(req.body.otp)) !== user.otpHash) { user.otpAttempts += 1; await user.save(); return res.status(400).json({ message: 'Invalid OTP' }); }
    user.otpHash = undefined; user.otpPurpose = undefined; user.otpExpiresAt = undefined; user.otpAttempts = 0;
    await user.save();
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { return next(error); }
});

module.exports = router;
