const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const { sendEmail } = require('../controllers/email.controller');

router.post('/send', protect, sendEmail);

module.exports = router;
