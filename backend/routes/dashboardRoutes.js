const express = require('express');
const router = express.Router();
const { getOverview, getReports, getAnalytics } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All dashboard endpoints are restricted to Managers/Admins
router.use(protect);
router.use(authorize('Manager/Admin'));

router.get('/overview', getOverview);
router.get('/reports', getReports);
router.get('/analytics', getAnalytics);

module.exports = router;
