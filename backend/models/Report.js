const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    weekStart: {
      type: Date,
      required: [true, 'Please provide the start date of the week'],
    },
    weekEnd: {
      type: Date,
      required: [true, 'Please provide the end date of the week'],
    },
    tasksCompleted: {
      type: String,
      required: [true, 'Please provide completed tasks'],
      trim: true,
    },
    tasksPlanned: {
      type: String,
      required: [true, 'Please provide planned tasks for next week'],
      trim: true,
    },
    blockers: {
      type: String,
      trim: true,
      default: '',
    },
    hoursWorked: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Submitted', 'Late'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per user, project, and week start
reportSchema.index({ userId: 1, projectId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
