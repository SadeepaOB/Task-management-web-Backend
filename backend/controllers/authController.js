const User = require('../models/User');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Please enter all required fields (name, email, password)');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    // Create user (role can be specified, defaults to Team Member)
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'Team Member',
    });

    if (user) {
      // Set session
      req.session.userId = user._id;
      req.session.userRole = user.role;
      req.session.userName = user.name;

      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & start session
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Please provide email and password');
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Save user details to session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userName = user.name;

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & destroy session
// @route   POST /api/auth/logout
// @access  Private (protect)
const logoutUser = async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        res.status(500);
        return next(new Error('Could not log out. Please try again.'));
      }
      res.clearCookie('sid'); // Cookie name configured in server.js
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged in user info
// @route   GET /api/auth/me
// @access  Private (protect)
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with role 'Team Member'
// @route   GET /api/auth/members
// @access  Private (protect, authorize('Manager/Admin'))
const getTeamMembers = async (req, res, next) => {
  try {
    const members = await User.find({ role: 'Team Member' }).select('name email role');
    res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  getTeamMembers,
};

