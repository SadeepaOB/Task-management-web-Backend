// Protect routes
const protect = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401);
    next(new Error('Not authorized, no session found. Please log in.'));
  }
};

// Authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.session && roles.includes(req.session.userRole)) {
      next();
    } else {
      res.status(403);
      next(new Error(`Role (${req.session.userRole || 'None'}) is not authorized to access this resource`));
    }
  };
};

module.exports = { protect, authorize };
