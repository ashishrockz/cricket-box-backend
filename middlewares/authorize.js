// optional role-based guard, not used by friend endpoints but kept for completeness
module.exports = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!allowedRoles.length) return next();
  if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};
