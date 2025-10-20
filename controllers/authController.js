const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendMail = require("../config/smtp");
const asyncWrapper = require("../utils/asyncWrapper");

exports.signup = asyncWrapper(async (req, res) => {
  const { username, password, email, city, role } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password are required" });

  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: "username already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password: hashed, email, city, role });

  if (email) {
    try {
      await sendMail(email, "Welcome to Cricket Box", `<p>Hello ${username}, your account is ready.</p>`);
    } catch (err) {
      console.warn("Failed to send welcome email:", err.message);
    }
  }

  res.status(201).json({ message: "User created", user: { id: user._id, username: user.username, role: user.role } });
});

exports.login = asyncWrapper(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password are required" });

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  const payload = { id: user._id, username: user.username, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

  res.json({ message: "Login successful", token, user: payload });
});
