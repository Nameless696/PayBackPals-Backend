const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
    getGroups,
    createGroup,
    getGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    joinGroup,
    exportGroupPDF,
    sendReminders,
} = require('../controllers/group.controller');

router.use(protect); // all group routes require auth

router.route('/')
    .get(getGroups)
    .post(createGroup);

router.route('/:id')
    .get(getGroup)
    .patch(updateGroup)
    .delete(deleteGroup);

router.post  ('/:id/members',              addMember);
router.delete('/:id/members/:memberId',    removeMember);
router.post  ('/:id/join',                 joinGroup);  // self-join by invite code
router.get   ('/:id/report',               exportGroupPDF);
router.post  ('/:id/reminders',            sendReminders);

module.exports = router;
