// centralized error handling middleware
const notFound = (req, res, next) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
};

// standard error handler
const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err.message || err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // friendly response for validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Validation Error", errors: err.errors });
  }

  // mongoose duplicate key
  if (err.code && err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ message: `${field} must be unique`, field });
  }

  res.status(statusCode).json({ message });
};

module.exports = { errorHandler, notFound };
