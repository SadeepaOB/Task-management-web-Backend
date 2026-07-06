const Report = require('../models/Report');
const Project = require('../models/Project');

// @desc    Create a weekly report
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res, next) => {
  try {
    const { projectId, weekStart, weekEnd, tasksCompleted, tasksPlanned, blockers, hoursWorked, notes } = req.body;

    if (!projectId || !weekStart || !weekEnd || !tasksCompleted || !tasksPlanned) {
      res.status(400);
      throw new Error('Please fill in all required fields (projectId, weekStart, weekEnd, tasksCompleted, tasksPlanned)');
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    // Check if report already exists for this week, project and user
    const existingReport = await Report.findOne({
      userId: req.session.userId,
      projectId,
      weekStart: new Date(weekStart),
    });

    if (existingReport) {
      res.status(400);
      throw new Error('You have already created a report for this project and week start date. Please edit the existing report instead.');
    }

    const report = await Report.create({
      userId: req.session.userId,
      projectId,
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      tasksCompleted,
      tasksPlanned,
      blockers: blockers || '',
      hoursWorked: hoursWorked || 0,
      notes: notes || '',
      status: 'Pending', // Initially created as Draft/Pending
    });

    res.status(201).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's reports
// @route   GET /api/reports/my
// @access  Private
const getMyReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.session.userId })
      .populate('projectId', 'name description')
      .sort({ weekStart: -1 });

    res.status(200).json({
      success: true,
      reports,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single report by ID
// @route   GET /api/reports/:id
// @access  Private
const getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('userId', 'name email role')
      .populate('projectId', 'name description');

    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Authorization: Team member can only see their own report, Managers can see all
    if (req.session.userRole !== 'Manager/Admin' && report.userId._id.toString() !== req.session.userId) {
      res.status(403);
      throw new Error('Access denied. You can only view your own reports.');
    }

    res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a report
// @route   PUT /api/reports/:id
// @access  Private
const updateReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Authorization: Team member can only edit their own, Managers can edit any
    if (req.session.userRole !== 'Manager/Admin' && report.userId.toString() !== req.session.userId) {
      res.status(403);
      throw new Error('Access denied. You can only update your own reports.');
    }

    // Team Member can only edit reports that are "Pending" (drafts)
    if (req.session.userRole !== 'Manager/Admin' && report.status !== 'Pending') {
      res.status(400);
      throw new Error('Submitted reports cannot be edited. Please contact your manager.');
    }

    const { projectId, weekStart, weekEnd, tasksCompleted, tasksPlanned, blockers, hoursWorked, notes } = req.body;

    // Update fields
    if (projectId) {
      // Check if project exists
      const project = await Project.findById(projectId);
      if (!project) {
        res.status(404);
        throw new Error('Project not found');
      }
      report.projectId = projectId;
    }

    if (weekStart) report.weekStart = new Date(weekStart);
    if (weekEnd) report.weekEnd = new Date(weekEnd);
    if (tasksCompleted !== undefined) report.tasksCompleted = tasksCompleted;
    if (tasksPlanned !== undefined) report.tasksPlanned = tasksPlanned;
    if (blockers !== undefined) report.blockers = blockers;
    if (hoursWorked !== undefined) report.hoursWorked = hoursWorked;
    if (notes !== undefined) report.notes = notes;

    const updatedReport = await report.save();

    res.status(200).json({
      success: true,
      report: updatedReport,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a report
// @route   DELETE /api/reports/:id
// @access  Private
const deleteReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Authorization: Team member can only delete their own, Managers can delete any
    if (req.session.userRole !== 'Manager/Admin' && report.userId.toString() !== req.session.userId) {
      res.status(403);
      throw new Error('Access denied. You can only delete your own reports.');
    }

    // Team Member can only delete reports that are "Pending" (drafts)
    if (req.session.userRole !== 'Manager/Admin' && report.status !== 'Pending') {
      res.status(400);
      throw new Error('Submitted reports cannot be deleted.');
    }

    await Report.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a report
// @route   POST /api/reports/:id/submit
// @access  Private
const submitReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    // Authorization: Team member can only submit their own
    if (report.userId.toString() !== req.session.userId) {
      res.status(403);
      throw new Error('Access denied. You can only submit your own reports.');
    }

    if (report.status !== 'Pending') {
      res.status(400);
      throw new Error('Report has already been submitted.');
    }

    // Auto-detect late submission:
    // If current local time is after report.weekEnd, mark it 'Late', otherwise 'Submitted'
    const now = new Date();
    const weekEndVal = new Date(report.weekEnd);
    
    // Add time buffer (e.g. up to end of the weekEnd day)
    // To make it clear: if now > weekEnd, it's late.
    if (now > weekEndVal) {
      report.status = 'Late';
    } else {
      report.status = 'Submitted';
    }

    const submittedReport = await report.save();

    res.status(200).json({
      success: true,
      report: submittedReport,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getMyReports,
  getReportById,
  updateReport,
  deleteReport,
  submitReport,
};
