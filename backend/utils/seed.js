const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Project = require('../models/Project');
const Report = require('../models/Report');

dotenv.config();

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/weekly-report-db');
    console.log('MongoDB connected for seeding...');

    // Clear existing collections
    await User.deleteMany({});
    await Project.deleteMany({});
    await Report.deleteMany({});
    console.log('Cleared existing data.');

    // 1. Create Users
    console.log('Creating users...');
    const manager = await User.create({
      name: 'Sarah Connor',
      email: 'manager@example.com',
      password: 'password123',
      role: 'Manager/Admin',
    });

    const alice = await User.create({
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const bob = await User.create({
      name: 'Bob Johnson',
      email: 'bob@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const charlie = await User.create({
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const diana = await User.create({
      name: 'Diana Prince',
      email: 'diana@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    console.log(`Created users: 1 Manager, 4 Team Members.`);

    // 2. Create Projects
    console.log('Creating projects...');
    const p1 = await Project.create({
      name: 'Frontend Redesign',
      description: 'Migrating codebase to Next.js and applying sleek modern Tailwind design.',
      assignedMembers: [alice._id, bob._id],
    });

    const p2 = await Project.create({
      name: 'Mobile App Launch',
      description: 'Preparing iOS and Android builds for App Store deployment.',
      assignedMembers: [bob._id, charlie._id],
    });

    const p3 = await Project.create({
      name: 'Marketing Campaign',
      description: 'Launching Q3 visual campaigns and brand marketing videos.',
      assignedMembers: [charlie._id, diana._id],
    });

    const p4 = await Project.create({
      name: 'Core API Refactor',
      description: 'Optimizing DB queries and updating Express endpoints to Node 20.',
      assignedMembers: [alice._id, diana._id],
    });

    console.log('Created 4 projects.');

    // 3. Create Reports
    console.log('Creating reports...');

    // Helper to calculate start & end dates
    const getWeekRange = (weeksAgo) => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - weeksAgo * 7;
      const start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    };

    // We'll seed reports for weeks: 3 weeks ago, 2 weeks ago, 1 week ago, and current week.
    const weeks = [3, 2, 1, 0];
    const team = [
      { user: alice, primaryProj: p1, secondaryProj: p4 },
      { user: bob, primaryProj: p2, secondaryProj: p1 },
      { user: charlie, primaryProj: p3, secondaryProj: p2 },
      { user: diana, primaryProj: p4, secondaryProj: p3 },
    ];

    for (const weeksAgo of weeks) {
      const { start, end } = getWeekRange(weeksAgo);

      for (const member of team) {
        // Determine status: Current week (0 weeks ago) has some pending drafts and some submitted
        let status = 'Submitted';
        if (weeksAgo === 0) {
          if (member.user.email === 'alice@example.com') status = 'Pending'; // Alice is still drafting
          else if (member.user.email === 'bob@example.com') status = 'Submitted';
          else if (member.user.email === 'charlie@example.com') status = 'Late'; // Charlie submitted late
          else status = 'Pending'; // Diana is drafting
        } else {
          // In previous weeks, most are submitted, maybe one late
          if (weeksAgo === 1 && member.user.email === 'diana@example.com') {
            status = 'Late';
          } else {
            status = 'Submitted';
          }
        }

        // Add blockers occasionally
        let blockerText = '';
        if (weeksAgo === 1 && member.user.email === 'bob@example.com') {
          blockerText = 'Waiting on Apple App Store dev console team approval. iOS builds are blocked.';
        } else if (weeksAgo === 0 && member.user.email === 'charlie@example.com') {
          blockerText = 'Figma design specs are incomplete for the Q3 campaign splash screen.';
        } else if (weeksAgo === 2 && member.user.email === 'alice@example.com') {
          blockerText = 'API rate limit errors on local integration environments.';
        }

        // Completed tasks wording
        const completedTasks = `Completed tasks for week of ${start.toLocaleDateString()}:\n` +
          `- Finalized initial sprint issues on project ${member.primaryProj.name}.\n` +
          `- Conducted code review with teammates.\n` +
          `- Logged and debugged unit tests for key services.`;

        // Planned tasks wording
        const plannedTasks = `Plans for next week:\n` +
          `- Continue work on ${member.primaryProj.name} milestones.\n` +
          `- Collaborate with client stakeholders regarding ${member.secondaryProj.name}.\n` +
          `- Perform performance profiling and documentation cleanups.`;

        await Report.create({
          userId: member.user._id,
          projectId: member.primaryProj._id,
          weekStart: start,
          weekEnd: end,
          tasksCompleted: completedTasks,
          tasksPlanned: plannedTasks,
          blockers: blockerText,
          hoursWorked: 28 + Math.floor(Math.random() * 12), // 28 to 39 hours
          notes: 'Standard progress. Ready for review.',
          status,
        });
      }
    }

    console.log('Seeded weekly reports for the past 4 weeks successfully.');
    mongoose.connection.close();
    console.log('Seeding finished. Database closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
