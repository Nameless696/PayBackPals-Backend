/**
 * PayBackPal — Personal Finance Controller
 */
const PersonalTransaction = require('../models/PersonalTransaction');
const Budget              = require('../models/Budget');

// ── GET /api/personal ─────────────────────────────────────────────
exports.getTransactions = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { period } = req.query; // 'week' | 'month' | 'all'

        let dateFilter = {};
        const now = new Date();
        if (period === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            dateFilter = { date: { $gte: start } };
        } else if (period === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { date: { $gte: start } };
        }

        const transactions = await PersonalTransaction.find({ userId, ...dateFilter })
            .sort('-date')
            .limit(500);

        res.json({ transactions: transactions.map(t => t.toJSON()) });
    } catch (err) { next(err); }
};

// ── POST /api/personal ────────────────────────────────────────────
exports.addTransaction = async (req, res, next) => {
    try {
        const { type, amount, description, category, date, isRecurring, recurringDay } = req.body;
        if (!type || !amount || !description) {
            return res.status(400).json({ message: 'Type, amount, and description are required' });
        }

        const transaction = await PersonalTransaction.create({
            userId: req.user._id,
            type, amount, description,
            category: category || 'other',
            date: date || new Date(),
            isRecurring: isRecurring || false,
            recurringDay: recurringDay || null,
        });

        res.status(201).json({ transaction: transaction.toJSON() });
    } catch (err) { next(err); }
};

// ── PATCH /api/personal/:id ───────────────────────────────────────
exports.updateTransaction = async (req, res, next) => {
    try {
        const transaction = await PersonalTransaction.findOne({ _id: req.params.id, userId: req.user._id });
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

        const allowed = ['type', 'amount', 'description', 'category', 'date', 'isRecurring', 'recurringDay'];
        allowed.forEach(f => { if (req.body[f] !== undefined) transaction[f] = req.body[f]; });
        await transaction.save();

        res.json({ transaction: transaction.toJSON() });
    } catch (err) { next(err); }
};

// ── DELETE /api/personal/:id ──────────────────────────────────────
exports.deleteTransaction = async (req, res, next) => {
    try {
        const result = await PersonalTransaction.deleteOne({ _id: req.params.id, userId: req.user._id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Transaction not found' });
        res.json({ message: 'Transaction deleted' });
    } catch (err) { next(err); }
};

// ── GET /api/personal/summary ─────────────────────────────────────
exports.getSummary = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { period } = req.query; // 'week' | 'month'

        const now = new Date();
        let start;
        if (period === 'week') {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const transactions = await PersonalTransaction.find({ userId, date: { $gte: start } });

        let totalIncome = 0, totalExpense = 0;
        const byCategory = {};

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;

            if (t.type === 'expense') {
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
            }
        });

        // Get budget
        const budget = await Budget.findOne({ userId });

        res.json({
            totalIncome,
            totalExpense,
            netBalance: totalIncome - totalExpense,
            byCategory,
            budget: budget ? budget.toJSON() : null,
            transactionCount: transactions.length,
        });
    } catch (err) { next(err); }
};

// ── GET /api/personal/budget ──────────────────────────────────────
exports.getBudget = async (req, res, next) => {
    try {
        const budget = await Budget.findOne({ userId: req.user._id });
        res.json({ budget: budget ? budget.toJSON() : null });
    } catch (err) { next(err); }
};

// ── POST /api/personal/budget ─────────────────────────────────────
exports.setBudget = async (req, res, next) => {
    try {
        const { monthlyLimit } = req.body;
        if (!monthlyLimit || monthlyLimit <= 0) {
            return res.status(400).json({ message: 'Monthly limit must be a positive number' });
        }

        const budget = await Budget.findOneAndUpdate(
            { userId: req.user._id },
            { monthlyLimit },
            { upsert: true, new: true, runValidators: true }
        );

        res.json({ budget: budget.toJSON() });
    } catch (err) { next(err); }
};

// ── POST /api/personal/process-recurring ──────────────────────────
// Called manually or by cron — creates this month's recurring transactions
exports.processRecurring = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Find all recurring templates
        const recurring = await PersonalTransaction.find({ userId, isRecurring: true });

        let created = 0;
        for (const tmpl of recurring) {
            // Check if already created this month
            const exists = await PersonalTransaction.findOne({
                userId,
                description: tmpl.description,
                amount: tmpl.amount,
                type: tmpl.type,
                date: { $gte: monthStart, $lte: monthEnd },
                isRecurring: false, // the generated instance is NOT recurring itself
            });

            if (!exists) {
                const day = tmpl.recurringDay || 1;
                await PersonalTransaction.create({
                    userId, type: tmpl.type, amount: tmpl.amount,
                    description: tmpl.description, category: tmpl.category,
                    date: new Date(now.getFullYear(), now.getMonth(), day),
                    isRecurring: false, // instance, not template
                });
                created++;
            }
        }

        res.json({ message: `Processed ${created} recurring transactions` });
    } catch (err) { next(err); }
};
