/**
 * PayBackPal — Sync Controller
 * GET  /api/sync        → return all groups + expenses + notifications for current user
 * POST /api/sync/import → bulk import local data into MongoDB
 */
const Group        = require('../models/Group');
const Expense      = require('../models/Expense');
const Notification = require('../models/Notification');

// ── GET /api/sync ─────────────────────────────────────────────────
exports.syncAll = async (req, res, next) => {
    try {
        const userId   = req.user._id.toString();

        const groups = await Group.find({ 'members.id': userId }).sort('-createdAt');
        const groupIds = groups.map(g => g._id);

        const expenses      = await Expense.find({ groupId: { $in: groupIds } }).sort('-date');
        const notifications = await Notification.find({ userId: req.user._id }).sort('-timestamp');

        res.json({
            groups:        groups.map(g => g.toJSON()),
            expenses:      expenses.map(e => e.toJSON()),
            notifications: notifications.map(n => n.toJSON()),
        });
    } catch (err) { next(err); }
};

// ── POST /api/sync/import ─────────────────────────────────────────
exports.importData = async (req, res, next) => {
    try {
        const { groups = [], expenses = [], notifications = [] } = req.body;
        const userId  = req.user._id;
        const userStr = userId.toString();

        let groupsImported = 0;
        let expImported    = 0;
        let notifImported  = 0;

        // Import groups
        for (const g of groups) {
            const existing = await Group.findOne({
                createdBy: userId,
                name: g.name,
            });
            if (!existing) {
                // Normalize members: creator always maps to real userId
                const members = (g.members || []).map(m => ({
                    userId: m.id === 'me' || m.id === userStr ? userId : undefined,
                    id:     m.id === 'me' ? userStr : m.id,
                    name:   m.name,
                    email:  m.email || '',
                }));

                const group = await Group.create({
                    name:        g.name,
                    description: g.description || '',
                    icon:        g.icon || '👥',
                    iconType:    g.iconType || 'emoji',
                    members,
                    createdBy: userId,
                    createdAt: g.createdAt ? new Date(g.createdAt) : new Date(),
                });

                // Import this group's expenses
                const groupExpenses = expenses.filter(e => e.groupId === g.id);
                for (const ex of groupExpenses) {
                    await Expense.create({
                        groupId:        group._id,
                        amount:         Number(ex.amount) || 0,
                        description:    ex.description || 'Imported expense',
                        category:       ex.category || 'other',
                        paidBy:         ex.paidBy === 'me' ? userStr : ex.paidBy,
                        splitAmong:     (ex.splitAmong || []).map(id => id === 'me' ? userStr : id),
                        date:           ex.date ? new Date(ex.date) : new Date(),
                        receipt:        ex.receipt || null,
                        isSettlement:   !!ex.isSettlement,
                        isContribution: !!ex.isContribution,
                        settlementFrom: ex.settlementFrom,
                        settlementTo:   ex.settlementTo,
                        method:         ex.method,
                        customCategoryName: ex.customCategoryName,
                        customCategoryIcon: ex.customCategoryIcon,
                        group:          g.name,
                        createdBy:      userId,
                    });
                    expImported++;
                }
                groupsImported++;
            }
        }

        // Import notifications
        for (const n of notifications) {
            await Notification.create({
                userId,
                type:      n.type || 'info',
                message:   n.message || '',
                data:      n.data || {},
                read:      !!n.read,
                timestamp: n.timestamp ? new Date(n.timestamp) : new Date(),
            });
            notifImported++;
        }

        res.json({
            message: `Imported ${groupsImported} groups, ${expImported} expenses, ${notifImported} notifications`,
            groupsImported, expImported, notifImported,
        });
    } catch (err) { next(err); }
};
