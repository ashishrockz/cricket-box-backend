const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendMail = require("../config/smtp");
const asyncWrapper = require("../utils/asyncWrapper");

exports.signup = asyncWrapper(async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password are required" });

  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).json({ message: "username already exists" });

  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "email already in use" });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ username: username.trim(), password: hashed, email: email || undefined });

  if (email) {
    try {
      await sendMail(email, "Welcome to Cricket Box", `<p>Hello ${username}, welcome to Cricket Box!</p>`);
    } catch (err) {
      console.warn("SMTP failed:", err.message);
    }
  }

  res.status(201).json({ message: "User created", user: { id: user._id, username: user.username , emai:user.email} });
});

exports.login = asyncWrapper(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "username and password required" });

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ message: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  const payload = { id: user._id, username: user.username };
  const token = jwt.sign(payload, process.env.JWT_SECRET || "the_box", { expiresIn: process.env.JWT_EXPIRES_IN || "600d" });

  res.json({ message: "Login successful", token, user: payload });
});
