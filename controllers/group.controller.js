/**
 * PayBackPal — Group Controller
 */
const Group        = require('../models/Group');
const Expense      = require('../models/Expense');
const Notification = require('../models/Notification');
const mongoose     = require('mongoose');

// Prevents 500 crash when frontend sends non-ObjectId local IDs (e.g. g_1775...)
async function findGroupSafe(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Group.findById(id);
}

async function sendInviteEmail(targetEmail, groupName, inviteCode) {
    if (!process.env.GOOGLE_SCRIPT_URL || !targetEmail) return;
    try {
        const payload = {
            to: targetEmail,
            subject: `You have been fully invited to join ${groupName} on PayBackPal!`,
            fromName: 'PayBackPal',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px;">
                    <h2 style="color:#6C63FF;text-align:center;">PayBackPal Invitation 👥</h2>
                    <p style="color:#B8B5D1;font-size:16px;">You have been invited to collaborate and split expenses inside the group: <strong>${groupName}</strong></p>
                    <div style="background:#1a1a2e;border:1px solid #2D2B45;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                        <p style="color:#6B6890;font-size:12px;text-transform:uppercase;margin-bottom:8px;">Your Secure Group Invite Code</p>
                        <span style="font-size:24px;font-weight:800;letter-spacing:2px;color:#fff;">${inviteCode}</span>
                    </div>
                    <p style="color:#888;font-size:13px;text-align:center;">Copy this 24-character Identity Code into your PayBackPal application under the "Join Existing Group" tab to instantly synchronize with the ledger.</p>
                </div>
            `
        };

        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if(!result.success) throw new Error(result.error);

        console.log(`[Group] Invite sent physically via Google Script HTTPS Relay to ${targetEmail}`);
    } catch (e) {
        console.error(`[Group] Invite email drop:`, e.message);
    }
}

// ── Helper: check membership ──────────────────────────────────────
const isMember = (group, userId) =>
    group.members.some(m => m.id === userId.toString() || m.userId?.toString() === userId.toString());

// ── GET /api/groups ───────────────────────────────────────────────
exports.getGroups = async (req, res, next) => {
    try {
        const userId = req.user._id.toString();
        const groups = await Group.find({
            'members.id': userId
        }).sort('-createdAt');
        res.json({ groups: groups.map(g => g.toJSON()) });
    } catch (err) { next(err); }
};

// ── POST /api/groups ──────────────────────────────────────────────
exports.createGroup = async (req, res, next) => {
    try {
        const { name, description, icon, iconType, members = [] } = req.body;
        if (!name) return res.status(400).json({ message: 'Group name is required' });

        const userId = req.user._id.toString();

        // Ensure creator is in members list
        const creatorEntry = { userId: req.user._id, id: userId, name: req.user.name, email: req.user.email };
        const otherMembers = members.filter(m => m.id !== userId && m.email !== req.user.email);

        const group = await Group.create({
            name, description, icon, iconType,
            members: [creatorEntry, ...otherMembers],
            createdBy: req.user._id,
        });

        res.status(201).json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── GET /api/groups/:id ───────────────────────────────────────────
exports.getGroup = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!isMember(group, req.user._id)) {
            return res.status(403).json({ message: 'Not a member of this group' });
        }
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── PATCH /api/groups/:id ─────────────────────────────────────────
exports.updateGroup = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the admin can update this group' });
        }

        const allowed = ['name', 'description', 'icon', 'iconType'];
        allowed.forEach(f => { if (req.body[f] !== undefined) group[f] = req.body[f]; });
        await group.save();
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id ────────────────────────────────────────
exports.deleteGroup = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the admin can delete this group' });
        }

        // Delete all expenses for this group
        await Expense.deleteMany({ groupId: group._id });
        // Delete all notifications related to this group
        await Notification.deleteMany({ 'data.groupId': group._id.toString() });

        await group.deleteOne();
        res.json({ message: 'Group and all its expenses deleted' });
    } catch (err) { next(err); }
};

// ── POST /api/groups/:id/members ──────────────────────────────────
exports.addMember = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!isMember(group, req.user._id)) {
            return res.status(403).json({ message: 'Not a member of this group' });
        }

        const { id, name, email } = req.body;
        if (!name) return res.status(400).json({ message: 'Member name is required' });

        const dup = group.members.some(m => (id && m.id && m.id === id) || (email && m.email && m.email === email));
        if (dup) return res.status(400).json({ message: 'Member already in group' });

        group.members.push({ id: id || `m${Date.now()}`, name, email: email || '' });
        await group.save();
        
        if (email) {
            // Trigger background physical email drop 
            sendInviteEmail(email, group.name, group._id.toString()).catch(() => {});
        }
        
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id/members/:memberId ──────────────────────
exports.removeMember = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the admin can remove members' });
        }

        group.members = group.members.filter(m => m.id !== req.params.memberId);
        await group.save();
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── POST /api/groups/:id/join ─────────────────────────────────────
// Allows any authenticated user to join a group by its ID (invite code)
// Does NOT require the user to already be a member (unlike addMember)
exports.joinGroup = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Invalid invite code — group not found' });

        const userId = req.user._id.toString();

        // Already a member? Return success silently
        const alreadyMember = group.members.some(m => m.id === userId || m.email === req.user.email);
        if (alreadyMember) return res.json({ group: group.toJSON(), message: 'Already a member' });

        group.members.push({
            id: userId,
            name: req.user.name,
            email: req.user.email,
            role: 'member',
            status: 'joined',
        });
        await group.save();
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};

// ── GET /api/groups/:id/report ────────────────────────────────────
// Generate a PDF summary of the group (base64 encoded)
exports.exportGroupPDF = async (req, res, next) => {
    try {
        const PDFDocument = require('pdfkit');
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!isMember(group, req.user._id)) {
            return res.status(403).json({ message: 'Not a member of this group' });
        }

        const expenses = await Expense.find({ groupId: group._id }).sort('-date').limit(500);

        // Build PDF in memory
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks = [];
        doc.on('data', c => chunks.push(c));

        // Header
        doc.fontSize(22).fillColor('#6C63FF').text('PayBackPal', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(16).fillColor('#333').text(`Group Report: ${group.name}`, { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#888').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1);

        // Members
        doc.fontSize(13).fillColor('#333').text('Members', { underline: true });
        doc.moveDown(0.3);
        group.members.forEach(m => {
            const role = m.id === group.createdBy.toString() ? ' (Admin)' : '';
            doc.fontSize(10).fillColor('#555').text(`• ${m.name} — ${m.email || 'No email'}${role}`);
        });
        doc.moveDown(1);

        // Summary
        const totalAmt = expenses.filter(e => !e.isSettlement).reduce((s, e) => s + (e.amount || 0), 0);
        const settlements = expenses.filter(e => e.isSettlement).reduce((s, e) => s + (e.amount || 0), 0);
        doc.fontSize(13).fillColor('#333').text('Summary', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#555').text(`Total Expenses: ${totalAmt.toFixed(2)}`);
        doc.text(`Total Settlements: ${settlements.toFixed(2)}`);
        doc.text(`Expense Count: ${expenses.filter(e => !e.isSettlement).length}`);
        doc.moveDown(1);

        // Expense ledger
        doc.fontSize(13).fillColor('#333').text('Expense Ledger', { underline: true });
        doc.moveDown(0.3);
        const memberMap = Object.fromEntries(group.members.map(m => [m.id, m.name]));
        expenses.filter(e => !e.isSettlement).slice(0, 50).forEach(e => {
            const payer = memberMap[e.paidBy] || e.paidBy;
            const date  = e.date ? new Date(e.date).toLocaleDateString() : '';
            doc.fontSize(9).fillColor('#555').text(
                `${date}  |  ${e.description}  |  Paid by ${payer}  |  ${e.amount.toFixed(2)}`
            );
        });

        doc.end();

        // Wait for stream to finish then send base64
        await new Promise(resolve => doc.on('end', resolve));
        const pdfBuffer = Buffer.concat(chunks);
        res.json({ pdf: pdfBuffer.toString('base64'), filename: `${group.name}_report.pdf` });
    } catch (err) { next(err); }
};

// ── POST /api/groups/:id/reminders ────────────────────────────────
// Admin sends debt reminder emails to all members who owe money
exports.sendReminders = async (req, res, next) => {
    try {
        const group = await findGroupSafe(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the admin can send reminders' });
        }

        if (!process.env.GOOGLE_SCRIPT_URL) {
            return res.status(400).json({ message: 'Email service is not configured (missing GOOGLE_SCRIPT_URL)' });
        }

        const expenses = await Expense.find({ groupId: group._id });
        const memberMap = Object.fromEntries(group.members.map(m => [m.id, m]));

        // Calculate net balances
        const net = {};
        expenses.forEach(e => {
            const split = Array.isArray(e.splitAmong) && e.splitAmong.length ? e.splitAmong : [e.paidBy];
            const payer = e.paidBy;
            if (!net[payer]) net[payer] = 0;

            if (e.isSettlement) {
                const payee = split[0];
                if (!net[payee]) net[payee] = 0;
                net[payer] += e.amount;
                net[payee] -= e.amount;
                return;
            }

            const share = e.amount / split.length;
            split.forEach(m => {
                if (!net[m]) net[m] = 0;
                if (m !== payer) {
                    net[payer] += share;
                    net[m]     -= share;
                }
            });
        });

        // Find debtors (negative balance = owes money)
        let sent = 0;
        for (const [memberId, balance] of Object.entries(net)) {
            if (balance < -0.01) {
                const member = memberMap[memberId];
                if (!member?.email) continue;

                const owes = Math.abs(balance).toFixed(2);
                try {
                    await fetch(process.env.GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: member.email,
                            subject: `PayBackPal Reminder: You owe in "${group.name}"`,
                            fromName: 'PayBackPal',
                            html: `
                                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;color:#fff;border-radius:12px;">
                                    <h2 style="color:#6C63FF;text-align:center;">Payment Reminder 💰</h2>
                                    <p style="color:#B8B5D1;font-size:16px;">Hi ${member.name},</p>
                                    <p style="color:#B8B5D1;">You currently owe <strong style="color:#EF4444;">${owes}</strong> in the group <strong>"${group.name}"</strong>.</p>
                                    <p style="color:#888;font-size:13px;">Open PayBackPal to settle your debts and stay on track!</p>
                                </div>
                            `
                        })
                    });
                    sent++;
                } catch (emailErr) {
                    console.error(`[Reminder] Failed to send to ${member.email}:`, emailErr.message);
                }
            }
        }

        res.json({ message: `Sent ${sent} reminder(s)`, sent });
    } catch (err) { next(err); }
};
