const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get all projects is open to all logged in users (e.g. members need list to file report)
router.get('/', protect, getProjects);

// Modifications restricted to Managers/Admins
router.post('/', protect, authorize('Manager/Admin'), createProject);
router.put('/:id', protect, authorize('Manager/Admin'), updateProject);
router.delete('/:id', protect, authorize('Manager/Admin'), deleteProject);

module.exports = router;
