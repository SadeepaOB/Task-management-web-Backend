const Report = require('../models/Report');
const User = require('../models/User');
const Project = require('../models/Project');

// Helper to get start and end of current week
const getCurrentWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  // Set to Monday of current week
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// @desc    Get dashboard overview KPI cards data
// @route   GET /api/dashboard/overview
// @access  Private (Manager/Admin only)
const getOverview = async (req, res, next) => {
  try {
    const { start: thisWeekStart, end: thisWeekEnd } = getCurrentWeekRange();

    // 1. Total reports submitted this week (status: 'Submitted' or 'Late')
    const reportsThisWeekCount = await Report.countDocuments({
      status: { $in: ['Submitted', 'Late'] },
      weekStart: { $gte: thisWeekStart, $lte: thisWeekEnd },
    });

    // 2. Submission Compliance Rate
    // Compliance = (Submitted or Late reports) / (Total reports in database)
    // Alternatively: (Number of users who submitted this week) / (Total Team Members)
    const totalTeamMembers = await User.countDocuments({ role: 'Team Member' });
    const usersSubmittedThisWeek = await Report.distinct('userId', {
      status: { $in: ['Submitted', 'Late'] },
      weekStart: { $gte: thisWeekStart, $lte: thisWeekEnd },
    });
    
    const complianceRate = totalTeamMembers > 0 
      ? Math.round((usersSubmittedThisWeek.length / totalTeamMembers) * 100)
      : 100;

    // 3. Number of open blockers (blockers field is not empty, report status is Submitted/Late)
    const openBlockersCount = await Report.countDocuments({
      status: { $in: ['Submitted', 'Late'] },
      blockers: { $ne: '', $exists: true },
    });

    // 4. General Stats
    const totalProjects = await Project.countDocuments({});
    const totalUsers = await User.countDocuments({});

    res.status(200).json({
      success: true,
      data: {
        reportsThisWeek: reportsThisWeekCount,
        complianceRate,
        openBlockers: openBlockersCount,
        totalProjects,
        totalTeamMembers,
        totalUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reports with filters and pagination
// @route   GET /api/dashboard/reports
// @access  Private (Manager/Admin only)
const getReports = async (req, res, next) => {
  try {
    const { userId, projectId, status, weekStart, page = 1, limit = 10 } = req.query;

    const query = {};

    if (userId) query.userId = userId;
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    if (weekStart) {
      const date = new Date(weekStart);
      // Allow searching for that exact week date
      query.weekStart = date;
    }

    const skipIndex = (page - 1) * limit;

    const totalReports = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate('userId', 'name email role')
      .populate('projectId', 'name description')
      .sort({ weekStart: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skipIndex);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalReports,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalReports / limit),
      },
      reports,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get aggregated charts and analytics data
// @route   GET /api/dashboard/analytics
// @access  Private (Manager/Admin only)
const getAnalytics = async (req, res, next) => {
  try {
    // 1. Tasks completed trend over time (group by weekStart)
    // We will aggregate reports grouped by weekStart, calculating total hours worked and total reports.
    const trendAggregation = await Report.aggregate([
      { $match: { status: { $in: ['Submitted', 'Late'] } } },
      {
        $group: {
          _id: '$weekStart',
          totalHours: { $sum: '$hoursWorked' },
          reportCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const tasksCompletedTrend = trendAggregation.map((item) => ({
      week: new Date(item._id).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      hoursWorked: item.totalHours,
      reportsCount: item.reportCount,
    }));

    // 2. Report submission status by team member
    // Find all team members, and for each find their counts of reports by status
    const teamMembers = await User.find({ role: 'Team Member' }).select('name');
    
    const submissionStatusByUser = [];
    for (const member of teamMembers) {
      const pendingCount = await Report.countDocuments({ userId: member._id, status: 'Pending' });
      const submittedCount = await Report.countDocuments({ userId: member._id, status: 'Submitted' });
      const lateCount = await Report.countDocuments({ userId: member._id, status: 'Late' });

      submissionStatusByUser.push({
        name: member.name,
        Draft: pendingCount,
        Submitted: submittedCount,
        Late: lateCount,
      });
    }

    // 3. Workload/task distribution by project
    // Summarize hours worked and report counts per project
    const projects = await Project.find({}).select('name');
    const workloadDistributionByProject = [];

    for (const project of projects) {
      const reports = await Report.find({ projectId: project._id, status: { $in: ['Submitted', 'Late'] } });
      const totalHours = reports.reduce((acc, curr) => acc + (curr.hoursWorked || 0), 0);
      
      workloadDistributionByProject.push({
        name: project.name,
        hoursWorked: totalHours,
        reportsCount: reports.length,
      });
    }

    // 4. Recent reports/activity feed (last 6 reports)
    const recentActivity = await Report.find({ status: { $in: ['Submitted', 'Late'] } })
      .populate('userId', 'name')
      .populate('projectId', 'name')
      .sort({ updatedAt: -1 })
      .limit(6);

    const activityFeed = recentActivity.map((r) => ({
      _id: r._id,
      userName: r.userId ? r.userId.name : 'Unknown User',
      projectName: r.projectId ? r.projectId.name : 'Unknown Project',
      status: r.status,
      timestamp: r.updatedAt,
      weekStart: r.weekStart,
    }));

    res.status(200).json({
      success: true,
      data: {
        tasksCompletedTrend,
        submissionStatusByUser,
        workloadDistributionByProject,
        activityFeed,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getReports,
  getAnalytics,
};
