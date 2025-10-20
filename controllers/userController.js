const User = require("../models/User");
const asyncWrapper = require("../utils/asyncWrapper");

exports.getProfile = asyncWrapper(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

exports.getAllUsers = asyncWrapper(async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});
