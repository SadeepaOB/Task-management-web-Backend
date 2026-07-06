const express = require('express');
const router = express.Router();
const {
  createReport,
  getMyReports,
  getReportById,
  updateReport,
  deleteReport,
  submitReport,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createReport);
router.get('/my', protect, getMyReports);
router.get('/:id', protect, getReportById);
router.put('/:id', protect, updateReport);
router.delete('/:id', protect, deleteReport);
router.post('/:id/submit', protect, submitReport);

module.exports = router;
