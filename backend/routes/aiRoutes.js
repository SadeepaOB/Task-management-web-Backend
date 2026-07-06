const express = require('express');
const router = express.Router();
const { handleChatQuery } = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/chat', protect, authorize('Manager/Admin'), handleChatQuery);

module.exports = router;
