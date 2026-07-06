const User = require('../models/User');
const Project = require('../models/Project');
const Report = require('../models/Report');

// Helper to query database context
const getDatabaseContext = async () => {
  const users = await User.find({}).select('name email role');
  const projects = await Project.find({}).select('name description');
  
  // Get all reports from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const reports = await Report.find({ createdAt: { $gte: thirtyDaysAgo } })
    .populate('userId', 'name role')
    .populate('projectId', 'name');

  return { users, projects, reports };
};

// @desc    Process AI Chat message
// @route   POST /api/ai/chat
// @access  Private (Manager/Admin only)
const handleChatQuery = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400);
      throw new Error('Please provide a message');
    }

    const { users, projects, reports } = await getDatabaseContext();
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      // --- DUAL-MODE 1: Use Gemini API ---
      try {
        const contextStr = JSON.stringify({
          systemInfo: "You are the AI Assistant for the Team Weekly Report Dashboard. Answer questions based ONLY on the provided database context. Keep answers concise, actionable, and formatted in markdown.",
          users: users.map(u => ({ id: u._id, name: u.name, role: u.role })),
          projects: projects.map(p => ({ id: p._id, name: p.name, description: p.description })),
          recentReports: reports.map(r => ({
            author: r.userId ? r.userId.name : 'Unknown',
            project: r.projectId ? r.projectId.name : 'Unknown',
            weekStart: r.weekStart,
            weekEnd: r.weekEnd,
            tasksCompleted: r.tasksCompleted,
            tasksPlanned: r.tasksPlanned,
            blockers: r.blockers,
            hoursWorked: r.hoursWorked,
            status: r.status
          }))
        });

        const prompt = `Database Context:\n${contextStr}\n\nUser Question: ${message}\n\nAnswer in Markdown:`;
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
          const aiResponse = data.candidates[0].content.parts[0].text;
          return res.status(200).json({
            success: true,
            response: aiResponse,
            source: 'gemini-api'
          });
        } else {
          console.warn('Gemini API returned unexpected response format, falling back to local engine.', data);
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to local engine:', err.message);
      }
    }

    // --- DUAL-MODE 2: Local Rule-Based Query Engine Fallback ---
    const lowerMessage = message.toLowerCase();
    let responseText = '';

    // 1. Blockers analysis
    if (lowerMessage.includes('blocker') || lowerMessage.includes('challenge') || lowerMessage.includes('stuck')) {
      const reportsWithBlockers = reports.filter(r => r.blockers && r.blockers.trim().length > 0 && r.status !== 'Pending');
      
      if (reportsWithBlockers.length === 0) {
        responseText = `### 🛑 Blocker Summary\n\nFantastic news! There are **no active blockers** reported by the team on any of the projects right now.`;
      } else {
        responseText = `### 🛑 Active Team Blockers\n\nThere are currently **${reportsWithBlockers.length} open blocker(s)** reported:\n\n`;
        
        // Group blockers by project
        const projectBlockers = {};
        reportsWithBlockers.forEach(r => {
          const projName = r.projectId ? r.projectId.name : 'Unassigned';
          if (!projectBlockers[projName]) projectBlockers[projName] = [];
          projectBlockers[projName].push({
            author: r.userId ? r.userId.name : 'Unknown',
            blocker: r.blockers,
            week: new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          });
        });

        for (const [project, items] of Object.entries(projectBlockers)) {
          responseText += `#### 📁 Project: ${project}\n`;
          items.forEach(item => {
            responseText += `- **${item.author}** (Week of ${item.week}): "${item.blocker}"\n`;
          });
          responseText += `\n`;
        }
      }
    }
    // 2. Weekly summary / progress query
    else if (lowerMessage.includes('summarize') || lowerMessage.includes('progress') || lowerMessage.includes('update') || lowerMessage.includes('weekly')) {
      const submittedReports = reports.filter(r => r.status !== 'Pending');

      if (submittedReports.length === 0) {
        responseText = `### 📝 Weekly Summary\n\nNo weekly reports have been submitted yet. Once team members submit their reports, you will see a compiled list of tasks completed and hours logged here.`;
      } else {
        const totalHours = submittedReports.reduce((acc, r) => acc + (r.hoursWorked || 0), 0);
        
        responseText = `### 📝 Weekly Progress Summary\n\nHere is an overview of the work done by the team recently:\n\n`;
        responseText += `- **Total Active Reports**: ${submittedReports.length}\n`;
        responseText += `- **Total Logged Hours**: ${totalHours} hours\n\n`;
        responseText += `#### Done This Week:\n`;

        submittedReports.forEach(r => {
          const author = r.userId ? r.userId.name : 'Unknown';
          const project = r.projectId ? r.projectId.name : 'Unknown';
          responseText += `- **${author}** [${project}]: ${r.tasksCompleted}\n`;
        });

        const nextPlans = submittedReports.filter(r => r.tasksPlanned);
        if (nextPlans.length > 0) {
          responseText += `\n#### Planned for Next Week:\n`;
          nextPlans.forEach(r => {
            const author = r.userId ? r.userId.name : 'Unknown';
            responseText += `- **${author}**: ${r.tasksPlanned}\n`;
          });
        }
      }
    }
    // 3. Project-specific query
    else {
      // Check if message mentions any project name
      let foundProject = null;
      for (const p of projects) {
        if (lowerMessage.includes(p.name.toLowerCase())) {
          foundProject = p;
          break;
        }
      }

      if (foundProject) {
        const projectReports = reports.filter(r => r.projectId && r.projectId.name.toLowerCase() === foundProject.name.toLowerCase() && r.status !== 'Pending');
        const assignedUsers = users.filter(u => foundProject._id && u.role === 'Team Member'); // Mapped project assignments (or mock all)

        responseText = `### 📁 Project Focus: ${foundProject.name}\n\n`;
        responseText += `*Description: ${foundProject.description || 'No description provided'}*\n\n`;
        
        if (projectReports.length === 0) {
          responseText += `There are no submitted reports for this project yet.`;
        } else {
          const totalHours = projectReports.reduce((acc, r) => acc + (r.hoursWorked || 0), 0);
          responseText += `- **Submitted Reports**: ${projectReports.length}\n`;
          responseText += `- **Total Logged Hours**: ${totalHours} hrs\n\n`;
          responseText += `#### Recent Activity:\n`;
          
          projectReports.forEach(r => {
            const author = r.userId ? r.userId.name : 'Unknown';
            responseText += `- **${author}** (Week of ${new Date(r.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}): ${r.tasksCompleted}\n`;
          });
        }
      } else {
        // 4. Default generic dashboard overview
        const activeUsersCount = users.filter(u => u.role === 'Team Member').length;
        const totalBlockers = reports.filter(r => r.blockers && r.blockers.trim().length > 0 && r.status !== 'Pending').length;

        responseText = `Hello! I can help you analyze team activity, summarize blockers, and generate weekly progress summaries. 

Here are some questions you can ask me:
- *"Summarize this week's progress"*
- *"Which project has the most blockers?"*
- *Or ask about specific projects like "What is the status of the design project?"*

#### Current Quick Dashboard Stats:
- **Total Team Members**: ${activeUsersCount}
- **Total Projects**: ${projects.length}
- **Submitted Reports (Last 30 Days)**: ${reports.filter(r => r.status !== 'Pending').length}
- **Open Blockers**: ${totalBlockers}
`;
      }
    }

    res.status(200).json({
      success: true,
      response: responseText,
      source: 'local-analytics-engine'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleChatQuery,
};
