const roleMiddleware = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    if (userRole === "admin") {
      return next();
    }

    if (userRole !== requiredRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};

module.exports = roleMiddleware;
