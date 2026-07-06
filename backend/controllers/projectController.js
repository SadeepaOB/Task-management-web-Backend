const Project = require('../models/Project');
const User = require('../models/User');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (Manager/Admin only)
const createProject = async (req, res, next) => {
  try {
    const { name, description, assignedMembers } = req.body;

    if (!name) {
      res.status(400);
      throw new Error('Please provide a project name');
    }

    // Verify assignedMembers are valid users if provided
    if (assignedMembers && assignedMembers.length > 0) {
      const userCount = await User.countDocuments({ _id: { $in: assignedMembers } });
      if (userCount !== assignedMembers.length) {
        res.status(400);
        throw new Error('One or more assigned members are invalid users');
      }
    }

    const project = await Project.create({
      name,
      description: description || '',
      assignedMembers: assignedMembers || [],
    });

    res.status(201).json({
      success: true,
      project,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all projects
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res, next) => {
  try {
    // Populate assignedMembers detail
    const projects = await Project.find({})
      .populate('assignedMembers', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private (Manager/Admin only)
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    const { name, description, assignedMembers } = req.body;

    if (name) project.name = name;
    if (description !== undefined) project.description = description;

    if (assignedMembers !== undefined) {
      if (assignedMembers.length > 0) {
        // Validate
        const userCount = await User.countDocuments({ _id: { $in: assignedMembers } });
        if (userCount !== assignedMembers.length) {
          res.status(400);
          throw new Error('One or more assigned members are invalid users');
        }
      }
      project.assignedMembers = assignedMembers;
    }

    const updatedProject = await project.save();

    // Populate members for response
    const populatedProject = await Project.findById(updatedProject._id)
      .populate('assignedMembers', 'name email role');

    res.status(200).json({
      success: true,
      project: populatedProject,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private (Manager/Admin only)
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    await Project.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
};
