const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser, getMe, getTeamMembers } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.get('/members', protect, authorize('Manager/Admin'), getTeamMembers);

module.exports = router;

