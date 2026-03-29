const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
    register,
    verifyEmail,
    resendVerification,
    login,
    getMe,
    updateProfile,
} = require('../controllers/auth.controller');

router.post('/register',             register);
router.post('/verify',               verifyEmail);
router.post('/resend-verification',  resendVerification);
router.post('/login',                login);
router.get ('/me',                   protect, getMe);
router.patch('/profile',             protect, updateProfile);

module.exports = router;
