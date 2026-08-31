const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "blockbite_super_secret_jwt_key_2026";

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1] || req.headers["x-access-token"];

  if (!token) {
    return res.status(401).json({ success: false, message: "Access token missing or invalid" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Action requires one of roles: [${roles.join(", ")}]`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole, JWT_SECRET };
