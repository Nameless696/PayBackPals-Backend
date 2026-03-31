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
    deleteAccount

} = require('../controllers/auth.controller');

router.post('/register',             register);
router.post('/verify',               verifyEmail);
router.post('/resend-verification',  resendVerification);
router.post('/login',                login);
router.get ('/me',                   protect, getMe);
router.delete('/me', protect, deleteAccount);
router.patch('/profile',             protect, updateProfile);
router.delete('/me', protect, deleteAccount);

module.exports = router;
