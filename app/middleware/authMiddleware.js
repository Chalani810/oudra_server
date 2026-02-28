// oudra-server/app/middleware/authMiddleware.js
// CHANGES FROM GLIMMER:
//  1. JWT payload now includes "platform" field (web / mobile)
//  2. Added platformMiddleware to enforce platform restrictions
//  3. roleMiddleware updated with new role names (manager/investor/fieldworker)

const jwt = require("jsonwebtoken");

// ─── 1. AUTH MIDDLEWARE ────────────────────────────────────────────────────────
// Verifies JWT and attaches decoded payload to req.user
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, email, platform }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};

// ─── 2. PLATFORM MIDDLEWARE ───────────────────────────────────────────────────
// Ensures users only access their allowed platform
// Usage: platformMiddleware("web") or platformMiddleware("mobile")
const platformMiddleware = (allowedPlatform) => {
  return (req, res, next) => {
    const tokenPlatform = req.user?.platform;

    if (tokenPlatform !== allowedPlatform) {
      return res.status(403).json({
        message: `Access denied. This endpoint is only accessible from the ${allowedPlatform} platform.`,
      });
    }
    next();
  };
};

// ─── 3. ROLE MIDDLEWARE ───────────────────────────────────────────────────────
// Restricts access to one or more roles
// Usage: roleMiddleware("manager") or roleMiddleware(["manager","investor"])
const roleMiddleware = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    const userRole = req.user?.role;

    // Manager always has full access
    if (userRole === "manager") {
      return next();
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

// Default export is authMiddleware function itself (keeps all Glimmer routes working)
// Named properties attached so Oudra routes can destructure what they need
authMiddleware.platformMiddleware = platformMiddleware;
authMiddleware.roleMiddleware = roleMiddleware;

module.exports = authMiddleware;