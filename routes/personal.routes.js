const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getSummary,
    getBudget,
    setBudget,
    processRecurring,
} = require('../controllers/personal.controller');

router.use(protect);

router.get ('/summary',           getSummary);
router.get ('/budget',            getBudget);
router.post('/budget',            setBudget);
router.post('/process-recurring', processRecurring);

router.route('/')
    .get(getTransactions)
    .post(addTransaction);

router.route('/:id')
    .patch(updateTransaction)
    .delete(deleteTransaction);

module.exports = router;
