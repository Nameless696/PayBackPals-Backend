/**
 * PayBackPal — Group Controller
 */
const Group        = require('../models/Group');
const Expense      = require('../models/Expense');
const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GOOGLE_EMAIL || 'paybackpal169@gmail.com',
        pass: process.env.GOOGLE_APP_PASSWORD || ''
    }
});

async function sendInviteEmail(targetEmail, groupName, inviteCode) {
    if (!process.env.GOOGLE_APP_PASSWORD || !targetEmail) return;
    try {
        const info = await transporter.sendMail({
            from: `"PayBackPal" <${process.env.GOOGLE_EMAIL || 'paybackpal169@gmail.com'}>`,
            to: targetEmail,
            subject: `You have been fully invited to join ${groupName} on PayBackPal!`,
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
            `,
        });
        console.log(`[Group] Invite sent physically via Nodemailer Google Relay to ${targetEmail}: ${info.messageId}`);
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
        const group = await Group.findById(req.params.id);
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
        const group = await Group.findById(req.params.id);
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
        const group = await Group.findById(req.params.id);
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
        const group = await Group.findById(req.params.id);
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
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the admin can remove members' });
        }

        group.members = group.members.filter(m => m.id !== req.params.memberId);
        await group.save();
        res.json({ group: group.toJSON() });
    } catch (err) { next(err); }
};
