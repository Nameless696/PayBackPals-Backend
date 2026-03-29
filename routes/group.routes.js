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

module.exports = router;
