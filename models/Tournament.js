const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["Knockout", "League"], default: "League" },
  city: String,
  venue: String,
  startDate: Date,
  endDate: Date,
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Match" }],
  status: { type: String, enum: ["upcoming", "ongoing", "completed"], default: "upcoming" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Tournament", tournamentSchema);
