// role based authorization middleware
module.exports = (allowedRoles = []) => (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (allowedRoles.length === 0) return next(); // no restriction
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient privileges" });
    }
    next();
  } catch (err) {
    next(err);
  }
};
