const mongoose = require("mongoose");

const statsSub = {
  matchesPlayed: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  dismissals: { type: Number, default: 0 }
};

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, lowercase: false },
  password: { type: String, required: true },
  email: { type: String, default: null },
  role: { type: String, enum: ["admin", "user", "umpire"], default: "user" },
  city: { type: String, default: null },
  stats: {
    localMatches: { type: statsSub, default: () => ({}) },
    tournamentMatches: { type: statsSub, default: () => ({}) }
  },
  totalStats: { type: statsSub, default: () => ({}) },
  achievements: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
