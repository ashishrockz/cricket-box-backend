const notFound = (req, res, next) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ message: `${field} must be unique`, field });
  }
  res.status(err.statusCode || 500).json({ message: err.message || "Internal Server Error" });
};

module.exports = { notFound, errorHandler };
