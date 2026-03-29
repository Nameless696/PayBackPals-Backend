const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const { syncAll, importData } = require('../controllers/sync.controller');

router.use(protect);

router.get ('/',       syncAll);
router.post('/import', importData);

module.exports = router;
